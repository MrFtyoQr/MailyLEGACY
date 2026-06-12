# POLÍTICA DE PRIVACIDAD
## MailyT Cuida — Aplicación Móvil y Portal Web
**Versión:** 1.0  
**Fecha de entrada en vigor:** 04 de junio de 2026  
**Responsable:** CAMSA (denominación pendiente de registro)  
**Correo de contacto:** privacidad@mailytcuida.com

---

## 1. IDENTIDAD DEL RESPONSABLE

De conformidad con la **Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP)** y su Reglamento, así como los Lineamientos del Aviso de Privacidad emitidos por el INAI, el responsable del tratamiento de sus datos personales es:

**CAMSA**  
Domicilio: [Domicilio fiscal pendiente de registro]  
RFC: [Pendiente]  
Correo electrónico: privacidad@mailytcuida.com  

---

## 2. DATOS PERSONALES QUE RECABAMOS

### 2.1 Datos de identificación y contacto
- Nombre completo
- Correo electrónico
- Número de teléfono (opcional)
- Fecha de nacimiento

### 2.2 Datos de salud (datos sensibles — Art. 9 LFPDPPP)
- Signos vitales (presión arterial, glucosa, frecuencia cardíaca, peso, talla, etc.)
- Medicamentos prescritos y adherencia
- Resultados de laboratorio y estudios de imagen
- Notas clínicas y recetas médicas
- Estado de ánimo y patrones de sueño (bienestar)
- Diagnósticos y padecimientos registrados por el usuario

### 2.3 Datos técnicos
- Dirección IP y datos de dispositivo
- Logs de acceso y uso de la aplicación
- Tokens de sesión (almacenados de forma cifrada)

---

## 3. FINALIDADES DEL TRATAMIENTO

### 3.1 Finalidades primarias (necesarias para el servicio)
| Finalidad | Base legal |
|---|---|
| Crear y gestionar la cuenta del usuario | Ejecución de contrato |
| Mostrar y gestionar el historial clínico | Consentimiento expreso |
| Enviar recordatorios de medicamentos | Consentimiento expreso |
| Permitir la comunicación paciente-médico | Consentimiento expreso |
| Gestionar suscripciones y pagos | Ejecución de contrato |
| Garantizar la seguridad de la plataforma | Interés legítimo |

### 3.2 Finalidades secundarias (puede oponerse en cualquier momento)
| Finalidad | Base legal |
|---|---|
| Enviar comunicaciones de marketing | Consentimiento |
| Análisis estadístico anonimizado de uso | Interés legítimo |
| Mejora de modelos de IA internos (datos anonimizados) | Consentimiento |

---

## 4. USO DE INTELIGENCIA ARTIFICIAL

### 4.1 Análisis de documentos médicos
MailyT Cuida ofrece una función de análisis orientativo de documentos mediante Inteligencia Artificial. **Al utilizar esta función, usted acepta expresamente** que:

a) Sus documentos serán procesados por proveedores externos de IA (**OpenAI** y/o **Anthropic**) bajo contratos de procesamiento de datos que incluyen obligaciones de confidencialidad y prohibición de uso para entrenamiento de modelos sin consentimiento adicional.

b) **Antes de enviar cualquier información a los sistemas de IA**, la plataforma aplica un proceso de **anonimización** que elimina:
- Nombre completo del paciente
- Número de seguridad social o CURP
- Dirección y datos de contacto
- Identificadores médicos directos

c) Los resultados del análisis de IA son **exclusivamente orientativos**. La plataforma citará únicamente fuentes oficiales reconocidas (OMS, SSA México, NOM vigentes, AHA, ADA) y **no emite diagnósticos médicos**, de conformidad con la **NOM-004-SSA3-2012** sobre el expediente clínico.

d) Cualquier recomendación generada por IA incluirá de forma obligatoria la siguiente leyenda:  
> *"Esta información es orientativa y no constituye un diagnóstico médico. Consulte a su médico especialista para evaluación clínica."*

### 4.2 Compartir resultados con su médico
Usted puede, de forma **voluntaria y revocable**, autorizar que su médico tratante registrado en la plataforma acceda a sus documentos y resultados de análisis. Esta acción queda registrada en el log de auditoría de la plataforma.

---

## 5. TRANSFERENCIAS DE DATOS

Sus datos personales podrán ser transferidos a:

| Destinatario | País | Finalidad | Base legal |
|---|---|---|---|
| OpenAI, LLC | EUA | Análisis de IA (datos anonimizados) | Consentimiento expreso |
| Anthropic, PBC | EUA | Análisis de IA (datos anonimizados) | Consentimiento expreso |
| Stripe, Inc. | EUA | Procesamiento de pagos | Ejecución de contrato |
| Cloudflare, Inc. | EUA | Almacenamiento de archivos (R2) | Ejecución de contrato |
| Sentry (Functional Software) | EUA | Monitoreo de errores técnicos | Interés legítimo |

**No vendemos, cedemos ni rentamos sus datos personales a terceros** con fines publicitarios o comerciales sin su consentimiento expreso.

Para transferencias a EUA, aplicamos las **Cláusulas Contractuales Estándar** y verificamos que los proveedores cuenten con certificaciones equivalentes (SOC 2 Type II, HIPAA BAA donde aplique).

---

## 6. DERECHOS ARCO Y DERECHOS ADICIONALES

Usted tiene derecho a:
- **Acceso:** Conocer qué datos tenemos sobre usted
- **Rectificación:** Corregir datos inexactos
- **Cancelación:** Solicitar la eliminación de sus datos
- **Oposición:** Oponerse a finalidades secundarias

Para ejercer sus derechos, escriba a: **privacidad@mailytcuida.com**  
Plazo de respuesta: **20 días hábiles** (prorrogable 20 días más por causa justificada)  
Autoridad de supervisión: **INAI** — www.inai.org.mx | 800-835-4324

---

## 7. MEDIDAS DE SEGURIDAD

Implementamos medidas técnicas, administrativas y físicas que incluyen:

- Cifrado en tránsito: **TLS 1.3**
- Cifrado en reposo: **AES-256** para datos sensibles
- Tokens de sesión almacenados con **Expo SecureStore** (cifrado del dispositivo)
- Acceso a datos de salud restringido por rol (RBAC)
- Registro de auditoría de todos los accesos al expediente
- Autenticación con límite de intentos fallidos (5 intentos / 15 min)
- Sin acceso directo de personal a datos de salud sin autorización registrada

---

## 8. CONSERVACIÓN DE DATOS

| Tipo de dato | Período de conservación |
|---|---|
| Datos de cuenta activa | Mientras la cuenta esté activa |
| Signos vitales e historial clínico | 5 años desde el último registro (NOM-004-SSA3-2012) |
| Logs de auditoría | 2 años |
| Datos de pago (tokenizados) | Según requerimientos de Stripe y CNBV |
| Datos tras cancelación de cuenta | 90 días (recuperación), luego eliminación permanente |

---

## 9. MENORES DE EDAD

MailyT Cuida no está dirigida a menores de 18 años como titulares de cuenta principal. Los menores pueden ser incluidos como **miembros familiares** bajo la tutela de un adulto responsable registrado en la plataforma, quien asume la responsabilidad del consentimiento.

---

## 10. MODIFICACIONES A ESTE AVISO

Nos reservamos el derecho de actualizar esta política. Le notificaremos de cambios sustanciales mediante:
- Notificación push en la aplicación
- Correo electrónico registrado
- Aviso en pantalla al abrir la app

La versión vigente siempre estará disponible en la aplicación en **Perfil → Configuración → Privacidad**.

---

## 11. CONTACTO Y QUEJAS

Para dudas, ejercicio de derechos ARCO o quejas:  
📧 **privacidad@mailytcuida.com**  
📱 Sección "Soporte" dentro de la aplicación

Si considera que su solicitud no fue atendida satisfactoriamente, puede acudir al **INAI**: www.inai.org.mx

---

*Este aviso de privacidad fue elaborado en cumplimiento de la LFPDPPP, su Reglamento y los Lineamientos del Aviso de Privacidad publicados en el DOF el 17 de enero de 2013.*
