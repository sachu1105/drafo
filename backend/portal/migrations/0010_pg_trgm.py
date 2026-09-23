"""Turn on trigram matching, where there is a Postgres to turn it on in.

`CreateExtension` is a no-op on any other backend, so this migration is safe to
apply against the SQLite database a laptop runs -- the search falls back to
`icontains` there, which needs no extension. See portal/search.py.

The extension is what makes `TrigramSimilarity` available, and that is what
lets "Kakanad" find "Kakkanad". Without it the Postgres path raises at query
time rather than at migrate time, which is the worst place to find out.
"""

from django.contrib.postgres.operations import TrigramExtension
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("portal", "0009_alter_project_status"),
    ]

    operations = [
        TrigramExtension(),
    ]
