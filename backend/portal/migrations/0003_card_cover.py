"""
The card gets a cover.

Separate from the logo on purpose. The logo is a mark: it has to stay legible
at 28 pixels tall in the client-page header, on its own, often with
transparency. The cover is a photograph cropped to a strip across the top of
the card. One file cannot be both -- asking it to be is how a wordmark comes
out as a smear.
"""

import portal.storage
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('portal', '0002_profile_and_card'),
    ]

    operations = [
        migrations.AddField(
            model_name='architect',
            name='cover',
            field=models.ImageField(blank=True, null=True, storage=portal.storage.media_storage, upload_to='covers/'),
        ),
    ]
