"""
The architect stops being only a letterhead.

0001 knew a practice name, a phone number and a logo, because that is all the
client's screen needed. This adds the person behind it -- their own name, what
they do, a photo and a line about themselves -- and a slug for the one page in
this product that anyone is allowed to open.

Existing accounts are given a slug here rather than on next save, so that the
column is uniformly populated and the card link is never a surprise "None".
Nobody's card is switched on by the migration: card_is_public defaults to
False and stays there until it is asked for.
"""

import portal.storage
from django.db import migrations, models
from django.utils.text import slugify

RESERVED = {
    "admin", "api", "c", "card", "django-admin", "login", "logout", "me",
    "new", "p", "privacy", "profile", "projects", "register", "settings",
    "static", "support", "terms", "_next",
}


def backfill_card_slugs(apps, schema_editor):
    Architect = apps.get_model("portal", "Architect")
    taken = set()
    for architect in Architect.objects.all().order_by("pk"):
        base = slugify(architect.practice_name)[:32].strip("-")
        if not base or base in RESERVED:
            base = f"{base or 'studio'}-studio"[:32].strip("-")
        candidate, suffix = base, 2
        while candidate in taken or candidate in RESERVED:
            tail = f"-{suffix}"
            candidate = f"{base[: 32 - len(tail)]}{tail}"
            suffix += 1
        taken.add(candidate)
        architect.card_slug = candidate
        architect.save(update_fields=["card_slug"])


def drop_card_slugs(apps, schema_editor):
    """Nothing to undo -- the column itself goes away on reverse."""


class Migration(migrations.Migration):

    dependencies = [
        ('portal', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='architect',
            name='avatar',
            field=models.ImageField(blank=True, null=True, storage=portal.storage.media_storage, upload_to='avatars/'),
        ),
        migrations.AddField(
            model_name='architect',
            name='bio',
            field=models.TextField(blank=True, max_length=600),
        ),
        migrations.AddField(
            model_name='architect',
            name='card_is_public',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='architect',
            name='card_slug',
            field=models.SlugField(blank=True, max_length=40, null=True, unique=True),
        ),
        migrations.AddField(
            model_name='architect',
            name='full_name',
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name='architect',
            name='location',
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name='architect',
            name='profession',
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name='architect',
            name='website',
            field=models.URLField(blank=True),
        ),
        migrations.RunPython(backfill_card_slugs, drop_card_slugs),
    ]
