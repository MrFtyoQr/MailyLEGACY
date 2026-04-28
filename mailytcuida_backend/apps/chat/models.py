import uuid
from django.db import models


class Conversation(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient    = models.ForeignKey(
        'accounts.PatientProfile', on_delete=models.CASCADE, related_name='conversations'
    )
    doctor     = models.ForeignKey(
        'accounts.DoctorProfile', on_delete=models.CASCADE, related_name='conversations'
    )
    is_active  = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)  # bumped on every new message

    class Meta:
        db_table = 'chat_conversation'
        ordering = ['-updated_at']
        constraints = [
            models.UniqueConstraint(
                fields=['patient', 'doctor'],
                name='unique_conversation_per_pair',
            )
        ]

    def __str__(self):
        return f'{self.patient} ↔ Dr. {self.doctor}'


class Message(models.Model):
    class MessageType(models.TextChoices):
        TEXT  = 'TEXT',  'Texto'
        IMAGE = 'IMAGE', 'Imagen'
        FILE  = 'FILE',  'Archivo'

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name='messages'
    )
    sender       = models.ForeignKey(
        'accounts.User', on_delete=models.CASCADE, related_name='sent_messages'
    )
    message_type = models.CharField(
        max_length=10, choices=MessageType.choices, default=MessageType.TEXT
    )
    text         = models.TextField(blank=True)
    file_url     = models.URLField(blank=True)
    file_name    = models.CharField(max_length=255, blank=True)
    is_read      = models.BooleanField(default=False, db_index=True)
    read_at      = models.DateTimeField(null=True, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'chat_message'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['conversation', 'is_read']),
        ]

    def __str__(self):
        preview = self.text[:40] if self.text else f'[{self.message_type}]'
        return f'{self.sender.email}: {preview}'
