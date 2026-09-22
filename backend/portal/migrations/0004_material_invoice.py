"""
A material can carry its invoice.

Separate from the photo on purpose: the photo is what the tile looks like,
the invoice is what was actually paid for it. A year later, when somebody is
trying to remember what the sanitary cost, it is the second one they want --
and it is a PDF, which an ImageField will not take.
"""

import portal.storage
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('portal', '0003_card_cover'),
    ]

    operations = [
        migrations.AddField(
            model_name='material',
            name='invoice',
            field=models.FileField(blank=True, null=True, storage=portal.storage.media_storage, upload_to='invoices/%Y/%m/'),
        ),
        migrations.AddField(
            model_name='material',
            name='invoice_name',
            field=models.CharField(blank=True, max_length=255),
        ),
    ]
