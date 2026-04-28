"""
Immutable audit log — records every significant action on medical data.

Design principles:
  - Records are NEVER updated or deleted (append-only table).
  - Each row captures: who, what action, on which object, from where, when.
  - Sensitive field values are NOT stored; only field names are listed.
  - The `actor` FK uses SET_NULL so logs survive user deletion.
"""
import uuid
from django.db import models


class AuditAction(models.TextChoices):
    # Auth
    LOGIN              = 'LOGIN',              'Inicio de sesión'
    LOGOUT             = 'LOGOUT',             'Cierre de sesión'
    # CRUD
    CREATE             = 'CREATE',             'Creación'
    READ               = 'READ',               'Lectura'
    UPDATE             = 'UPDATE',             'Actualización'
    DELETE             = 'DELETE',             'Eliminación'
    # Medical specific
    MEDICATION_TAKEN   = 'MEDICATION_TAKEN',   'Medicamento tomado'
    MEDICATION_SKIPPED = 'MEDICATION_SKIPPED', 'Medicamento omitido'
    LAB_UPLOADED       = 'LAB_UPLOADED',       'Lab subido'
    DOCUMENT_SHARED    = 'DOCUMENT_SHARED',    'Documento compartido'
    DOCUMENT_REVOKED   = 'DOCUMENT_REVOKED',   'Acceso revocado'
    EXPORT_PDF         = 'EXPORT_PDF',         'Exportación PDF'
    INSIGHT_GENERATED  = 'INSIGHT_GENERATED',  'Insight generado'
    # Admin
    PERMISSION_CHANGE  = 'PERMISSION_CHANGE',  'Cambio de permisos'
    PLAN_CHANGE        = 'PLAN_CHANGE',        'Cambio de plan'
    # Security
    ACCESS_DENIED      = 'ACCESS_DENIED',      'Acceso denegado'
    TOKEN_REVOKED      = 'TOKEN_REVOKED',      'Token revocado'


class ResourceType(models.TextChoices):
    USER           = 'USER',          'Usuario'
    PATIENT        = 'PATIENT',       'Paciente'
    DOCTOR         = 'DOCTOR',        'Doctor'
    MEDICATION     = 'MEDICATION',    'Medicamento'
    MEDICATION_HISTORY = 'MEDICATION_HISTORY', 'Historial medicamento'
    VITAL_SIGN     = 'VITAL_SIGN',    'Signo vital'
    LAB_RESULT     = 'LAB_RESULT',    'Resultado lab'
    LAB_PANEL      = 'LAB_PANEL',     'Panel lab'
    APPOINTMENT    = 'APPOINTMENT',   'Cita'
    DOCUMENT       = 'DOCUMENT',      'Documento'
    CHAT           = 'CHAT',          'Chat'
    SUBSCRIPTION   = 'SUBSCRIPTION',  'Suscripción'
    INSIGHT        = 'INSIGHT',       'Insight'
    EXPORT         = 'EXPORT',        'Exportación'
    OTHER          = 'OTHER',         'Otro'


class AuditLog(models.Model):
    """
    Append-only audit record.  Never update or delete rows in this table.
    """
    id            = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Who performed the action (null when the actor account was deleted)
    actor         = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='audit_entries',
    )
    actor_role    = models.CharField(max_length=20, blank=True,
                                     help_text='Role snapshot at the time of action')
    actor_email   = models.EmailField(blank=True,
                                      help_text='Email snapshot (persists after user deletion)')

    # What happened
    action        = models.CharField(max_length=25, choices=AuditAction.choices)

    # What object was affected
    resource_type = models.CharField(max_length=25, choices=ResourceType.choices,
                                     default=ResourceType.OTHER)
    resource_id   = models.CharField(max_length=64, blank=True,
                                     help_text='UUID or PK of the affected object')

    # The patient whose data was touched (important for access audits)
    patient       = models.ForeignKey(
        'accounts.PatientProfile',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='audit_entries',
    )

    # Context
    ip_address    = models.GenericIPAddressField(null=True, blank=True)
    user_agent    = models.TextField(blank=True)
    endpoint      = models.CharField(max_length=255, blank=True,
                                     help_text='HTTP method + path, e.g. POST /api/v1/medications/')
    http_status   = models.PositiveSmallIntegerField(null=True, blank=True)

    # Changed fields (names only, never values)
    changed_fields = models.JSONField(default=list, blank=True,
                                      help_text='List of field names that changed')

    # Free-form note (e.g., "Clerk webhook", "Celery task")
    note          = models.TextField(blank=True)

    # Immutable timestamp
    created_at    = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes  = [
            models.Index(fields=['actor', 'created_at']),
            models.Index(fields=['patient', 'created_at']),
            models.Index(fields=['resource_type', 'resource_id']),
            models.Index(fields=['action', 'created_at']),
        ]

    def save(self, *args, **kwargs):
        # Guard: never allow updates to existing rows
        if self.pk and AuditLog.objects.filter(pk=self.pk).exists():
            raise ValueError('AuditLog records are immutable — cannot update.')
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValueError('AuditLog records are immutable — cannot delete.')

    def __str__(self):
        return f'[{self.created_at:%Y-%m-%d %H:%M}] {self.actor_email} — {self.action} {self.resource_type}({self.resource_id})'
