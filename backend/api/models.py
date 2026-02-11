from django.db import models


class STTModel(models.Model):
    """Store STT (Speech-to-Text) model configurations"""
    
    name = models.CharField(max_length=100, unique=True, help_text="Model identifier (e.g., base, small, medium)")
    model_type = models.CharField(max_length=50, default='whisper', help_text="Type of STT model (e.g., whisper)")
    device = models.CharField(max_length=20, default='cpu', help_text="Device to run on (cpu, cuda)")
    compute_type = models.CharField(max_length=20, default='int8', help_text="Compute precision (int8, float16, float32)")
    is_active = models.BooleanField(default=False, help_text="Is this the currently active model?")
    is_default = models.BooleanField(default=False, help_text="Is this the default model?")
    description = models.TextField(blank=True, help_text="Description of the model")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = "STT Model"
        verbose_name_plural = "STT Models"

    def __str__(self):
        return f"{self.model_type} - {self.name}"

    def save(self, *args, **kwargs):
        # Ensure only one model is active at a time
        if self.is_active:
            STTModel.objects.filter(is_active=True).exclude(pk=self.pk).update(is_active=False)
        
        # Ensure only one model is default
        if self.is_default:
            STTModel.objects.filter(is_default=True).exclude(pk=self.pk).update(is_default=False)
        
        super().save(*args, **kwargs)


class NERModel(models.Model):
    """Store NER (Named Entity Recognition) model configurations"""
    
    name = models.CharField(max_length=100, unique=True, help_text="Model identifier (e.g., slot_model)")
    model_type = models.CharField(max_length=50, default='slot-filling', help_text="Type of NER model")
    model_path = models.CharField(max_length=255, help_text="Path to model directory")
    device = models.CharField(max_length=20, default='cpu', help_text="Device to run on (cpu, cuda)")
    is_active = models.BooleanField(default=False, help_text="Is this the currently active model?")
    status = models.CharField(max_length=20, default='created', help_text="Model status (active, created, training)")
    description = models.TextField(blank=True, help_text="Description of the model")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "NER Model"
        verbose_name_plural = "NER Models"

    def __str__(self):
        return f"{self.model_type} - {self.name}"

    def save(self, *args, **kwargs):
        # Ensure only one model is active at a time
        if self.is_active:
            NERModel.objects.filter(is_active=True).exclude(pk=self.pk).update(is_active=False)
            self.status = 'active'
        
        super().save(*args, **kwargs)
