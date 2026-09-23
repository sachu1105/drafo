"""
Finding a project in your own list.

Postgres does the work. Not `icontains`, because the way an architect actually
looks for a job is by half-remembering it: they type the client's surname, or
the place, or the first four letters of a word spelled differently from how
they spelled it eighteen months ago. `icontains` answers none of those -- it is
a substring test, and a substring test says nothing about how well anything
matched, so there is no order to put the results in.

Three arms, combined, and each earns its place:

  full text    stems, so "drawings" finds "drawing" and "kitchens" finds
               "kitchen", and ranks what it finds. `websearch` parsing means a
               quoted phrase and a leading minus behave the way anyone who has
               used a search box expects.

  trigram      survives a typo and a different spelling. "Kakanad" finds
               "Kakkanad"; full text does not, because they are simply not the
               same word.

  contains     the prefix case. Full text matches whole words, so somebody
               four letters into typing "Kakkanad" has matched nothing at all,
               and a search box that stays empty until the last keystroke
               feels broken.

The client's name is searched alongside the project's, at a lower weight. Half
of what an architect remembers about a job is whose it is, and a box labelled
search that cannot find "Thomas" on Mr Thomas's villa is a box they use once.

SQLite has none of this, and the local development database is SQLite while
production is Postgres. Rather than make the two behave differently in silence,
the fallback is deliberate and narrow: plain `icontains`, no ranking. It keeps
`manage.py runserver` and the test suite working on a laptop. The real
behaviour is the Postgres one, which is what `docker compose` runs and what the
README says to do the pre-deploy pass under.
"""

from __future__ import annotations

from django.db import connection
from django.db.models import Q, QuerySet

# Below this, a trigram match is two words that happen to share some letters.
# Tuned against short Indian place and practice names, which are the hard case:
# too low and every project matches, too high and "Kakanad" stops finding
# "Kakkanad", which is the whole reason trigram is here.
SIMILARITY_FLOOR = 0.2


def search_projects(queryset: QuerySet, term: str) -> QuerySet:
    """Narrow a project queryset to what matches `term`, best first.

    Always applied to a queryset already filtered to one architect. This adds
    no scoping of its own, and must never be handed an unscoped one.
    """
    term = (term or "").strip()
    if not term:
        return queryset

    substring = Q(name__icontains=term) | Q(client_name__icontains=term)

    if connection.vendor != "postgresql":
        return queryset.filter(substring)

    # Imported here, not at module level: these pull in psycopg's postgres
    # bindings, and this module is also loaded on a SQLite laptop.
    from django.contrib.postgres.search import (
        SearchQuery,
        SearchRank,
        SearchVector,
        TrigramSimilarity,
    )
    from django.db.models.functions import Greatest

    vector = SearchVector("name", weight="A") + SearchVector(
        "client_name", weight="B"
    )
    query = SearchQuery(term, search_type="websearch")

    return (
        queryset.annotate(
            rank=SearchRank(vector, query),
            similarity=Greatest(
                TrigramSimilarity("name", term),
                TrigramSimilarity("client_name", term),
            ),
        )
        .filter(Q(rank__gt=0) | Q(similarity__gte=SIMILARITY_FLOOR) | substring)
        # Rank first, then how close the spelling was, then the ordinary order
        # of the list -- so two equally good matches come back newest first
        # rather than in whatever order the planner felt like.
        .order_by("-rank", "-similarity", "-updated_at")
    )
