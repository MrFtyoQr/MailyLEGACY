"""
Rule-based recommendations for common abnormal lab parameters.
Maps parameter name fragments (lowercase) → list of (RecType, message) tuples.
Future: replace/augment with LLM for GOLD/PLATINUM plans (M09 Analytics).
"""
from .models import LabRec

# keyword → [(rec_type, message), ...]
_RULES: dict[str, list[tuple[str, str]]] = {
    'triglicér': [
        ('DIET',      'Reduce el consumo de azúcares simples, harinas refinadas y alcohol.'),
        ('EXERCISE',  'Realiza al menos 150 min/semana de ejercicio aeróbico moderado.'),
        ('LIFESTYLE', 'Evita el ayuno prolongado; prefiere 5 comidas pequeñas al día.'),
    ],
    'colesterol total': [
        ('DIET',      'Limita las grasas saturadas y trans. Aumenta fibra soluble (avena, legumbres).'),
        ('EXERCISE',  'El ejercicio regular eleva el colesterol HDL protector.'),
    ],
    'hdl': [
        ('EXERCISE',  'El ejercicio aeróbico es la forma más efectiva de elevar el HDL.'),
        ('LIFESTYLE', 'Dejar de fumar y reducir el peso corporal mejoran el HDL.'),
    ],
    'ldl': [
        ('DIET',      'Reduce carnes rojas, lácteos enteros y aceites de coco/palma.'),
        ('FOLLOW_UP', 'Consulta a tu médico para evaluar si necesitas tratamiento farmacológico.'),
    ],
    'glucosa': [
        ('DIET',      'Evita bebidas azucaradas y carbohidratos refinados. Prefiere granos enteros.'),
        ('EXERCISE',  'Caminar 30 min después de cada comida ayuda a controlar la glucosa postprandial.'),
        ('FOLLOW_UP', 'Realiza una prueba de tolerancia a la glucosa si el valor se mantiene elevado.'),
    ],
    'hba1c': [
        ('FOLLOW_UP', 'El control de HbA1c debe revisarse cada 3 meses con tu médico.'),
        ('DIET',      'Distribuye los carbohidratos en porciones iguales a lo largo del día.'),
    ],
    'creatinina': [
        ('LIFESTYLE', 'Mantén una hidratación adecuada (1.5–2 L de agua al día).'),
        ('FOLLOW_UP', 'Una creatinina elevada puede indicar disfunción renal; consulta a tu médico.'),
        ('DIET',      'Modera el consumo de proteínas animales si el valor es persistentemente alto.'),
    ],
    'urea': [
        ('DIET',      'Reduce el consumo de proteínas animales en exceso.'),
        ('LIFESTYLE', 'Aumenta la ingesta de agua para favorecer la eliminación renal.'),
    ],
    'ácido úrico': [
        ('DIET',      'Evita vísceras, mariscos, embutidos y alcohol (especialmente cerveza).'),
        ('LIFESTYLE', 'Mantén un peso saludable; la obesidad eleva el ácido úrico.'),
    ],
    'alt': [
        ('LIFESTYLE', 'Evita el alcohol y fármacos hepatotóxicos sin supervisión médica.'),
        ('FOLLOW_UP', 'Una ALT elevada requiere evaluación de la función hepática completa.'),
    ],
    'ast': [
        ('FOLLOW_UP', 'Una AST elevada puede tener origen hepático o muscular; consulta a tu médico.'),
    ],
    'tsh': [
        ('FOLLOW_UP', 'Una TSH alterada requiere evaluación completa de la función tiroidea.'),
    ],
    'hemoglobina': [
        ('DIET',      'Aumenta alimentos ricos en hierro: carnes rojas magras, legumbres, espinacas.'),
        ('DIET',      'Combina el hierro con vitamina C para mejorar su absorción.'),
        ('FOLLOW_UP', 'La anemia persistente requiere evaluación de la causa subyacente.'),
    ],
}


def get_recommendations(parameter: str, status: str) -> list[tuple[str, str]]:
    """
    Return list of (rec_type, message) for a given parameter and abnormal status.
    Only generates recommendations for ABNORMAL_LOW, ABNORMAL_HIGH, or CRITICAL.
    """
    if status not in ('ABNORMAL_LOW', 'ABNORMAL_HIGH', 'CRITICAL'):
        return []

    param_lower = parameter.lower()
    for keyword, recs in _RULES.items():
        if keyword in param_lower:
            return recs
    return []


def create_recommendations_for_result(result) -> int:
    """
    Create LabRec objects for a LabResult based on rule engine.
    Returns the number of recommendations created.
    """
    recs = get_recommendations(result.parameter, result.status)
    count = 0
    for rec_type, message in recs:
        LabRec.objects.get_or_create(
            result=result,
            rec_type=rec_type,
            defaults={'message': message},
        )
        count += 1
    return count
