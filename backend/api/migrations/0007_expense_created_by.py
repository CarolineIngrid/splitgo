import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
from django.db.models import F


def backfill_created_by(apps, schema_editor):
    Expense = apps.get_model('api', 'Expense')
    Expense.objects.filter(created_by__isnull=True).update(
        created_by_id=F('paid_by_id'),
    )


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0006_grouppayment'),
    ]

    operations = [
        migrations.AddField(
            model_name='expense',
            name='created_by',
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='created_expenses',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(backfill_created_by, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='expense',
            name='created_by',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name='created_expenses',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
