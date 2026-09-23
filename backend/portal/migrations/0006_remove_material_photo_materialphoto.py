"""Materials get a gallery instead of a single photograph.

The order of operations matters and is not what makemigrations wrote. The
generated version dropped `Material.photo` first and created the new table
afterwards, which would have thrown away every picture already uploaded. Here
the table is created, the existing photos are carried into it, and only then
is the old column removed.

No bytes move. `ImageField.name` is the path within the storage backend, and
both fields point at the same one under the same `materials/%Y/%m/` prefix, so
carrying a photo across is copying a string.
"""

import django.db.models.deletion
import portal.storage
from django.db import migrations, models


def carry_photos_across(apps, schema_editor):
    Material = apps.get_model("portal", "Material")
    MaterialPhoto = apps.get_model("portal", "MaterialPhoto")
    MaterialPhoto.objects.bulk_create(
        [
            MaterialPhoto(material_id=pk, image=name, order=0)
            for pk, name in Material.objects.exclude(photo="")
            .exclude(photo=None)
            .values_list("pk", "photo")
        ]
    )


def carry_photos_back(apps, schema_editor):
    """Put the first picture back on the material, and lose the rest.

    Nothing can be done about the rest: the column being restored holds one.
    """
    Material = apps.get_model("portal", "Material")
    MaterialPhoto = apps.get_model("portal", "MaterialPhoto")
    for photo in MaterialPhoto.objects.order_by("material_id", "order", "id"):
        Material.objects.filter(pk=photo.material_id, photo="").update(
            photo=photo.image
        )


class Migration(migrations.Migration):

    dependencies = [
        ("portal", "0005_architect_email_verified_at"),
    ]

    operations = [
        migrations.CreateModel(
            name="MaterialPhoto",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("image", models.ImageField(storage=portal.storage.media_storage, upload_to="materials/%Y/%m/")),
                ("order", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("material", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="photos", to="portal.material")),
            ],
            options={
                "ordering": ("order", "id"),
            },
        ),
        migrations.RunPython(carry_photos_across, carry_photos_back),
        migrations.RemoveField(
            model_name="material",
            name="photo",
        ),
    ]
