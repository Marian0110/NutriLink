import requests
import pandas as pd
from config import API_KEY, DB_USER, DB_PASSWORD, DB_NAME, DB_HOST, DB_PORT
import json
from sqlalchemy import create_engine, inspect, MetaData, Table, Column, Integer, String, Numeric, Date, DateTime, ForeignKey, Time, Boolean, Float
# ---------------------------------------
# --- Mapeo de Nombre Español a Diccionario con FDC ID y Datos Manuales ---
alimentos_por_id = {
    # (Tu diccionario alimentos_por_id completo aquí... sin cambios)
    # Frutas
    "plátano":           {"fdc_id": 173944, "num_medidas": 0.5, "medida": "unidades", "masa_gr": 60},
    "manzana":           {"fdc_id": 168201, "num_medidas": 1, "medida": "unidades chicas", "masa_gr": 100},
    "naranja":           {"fdc_id": 169918, "num_medidas": 1, "medida": "unidades regulares", "masa_gr": 120},
    "uvas":              {"fdc_id": 174683, "num_medidas": 10, "medida": "unidades", "masa_gr": 90},
    "sandía":            {"fdc_id": 167765, "num_medidas": 1, "medida": "tazas", "masa_gr": 200},
    # Cereales
    "arroz":             {"fdc_id": 169756, "num_medidas": 0.25, "medida": "tazas", "masa_gr": 40},
    "maíz":              {"fdc_id": 169998, "num_medidas": 1, "medida": "tazas", "masa_gr": 120},
    "avena":             {"fdc_id": 169705, "num_medidas": 0.5, "medida": "tazas",  "masa_gr": 40},
    "pan de molde":      {"fdc_id": 172686, "num_medidas": 3, "medida": "rebanadas",  "masa_gr": 60},
    "fideos de arroz":   {"fdc_id": 169742, "num_medidas": 0.5, "medida": "tazas",  "masa_gr": 40},
    # Lácteos medios en grasas
    "queso ricotta":     {"fdc_id": 171248, "num_medidas": 2, "medida": "cucharadas", "masa_gr": 40},
    "yogurt diet":       {"fdc_id": 170887, "num_medidas": 1, "medida": "unidades", "masa_gr": 175},
    "leche de soya":     {"fdc_id": 175218, "num_medidas": 1, "medida": "tazas", "masa_gr": 200},
    "tofu":              {"fdc_id": 174291, "num_medidas": 1, "medida": "rebanadas", "masa_gr": 70},
    # Lácteos bajos en grasas
    "leche descremada fluida": {"fdc_id": 171267, "num_medidas": 1, "medida": "tazas", "masa_gr": 200},
    "leche descremada en polvo": {"fdc_id": 172195, "num_medidas": 2, "medida": "cucharadas", "masa_gr": 20},
    # Lácteos altos en grasas
    "leche entera fluida": {"fdc_id": 170879, "num_medidas": 1, "medida": "tazas", "masa_gr": 200},
    "leche entera en polvo": {"fdc_id": 173454, "num_medidas": 2, "medida": "cucharadas", "masa_gr": 20},
    # Verduras general
    "brócoli":           {"fdc_id": 170379, "num_medidas": 1, "medida": "tazas",  "masa_gr": 100},
    "coliflor":          {"fdc_id": 169986, "num_medidas": 1, "medida": "tazas",  "masa_gr": 110},
    "zanahoria":         {"fdc_id": 170393, "num_medidas": 1, "medida": "tazas",  "masa_gr": 50},
    "zapallo":           {"fdc_id": 170487, "num_medidas": 0.5, "medida": "tazas",  "masa_gr": 70},
    "tomate":            {"fdc_id": 170457, "num_medidas": 1, "medida": "unidades regulares",  "masa_gr": 120},
    # Verduras libre consumo
    "repollo":           {"fdc_id": 169975, "num_medidas": 1, "medida": "tazas",  "masa_gr": 50},
    "lechuga":           {"fdc_id": 169249, "num_medidas": 1, "medida": "tazas",  "masa_gr": 50},
    "apio":              {"fdc_id": 169988, "num_medidas": 1, "medida": "tazas",  "masa_gr": 70},
    "pimentón rojo":     {"fdc_id": 170108, "num_medidas": 0.5, "medida": "tazas",  "masa_gr": 60},
    "kale":              {"fdc_id": 168421, "num_medidas": 1, "medida": "tazas",  "masa_gr": 50},
    # Carnes altas en grasa
    "salmón":            {"fdc_id": 175138, "num_medidas": 1, "medida": "trozos de 10x6x1",  "masa_gr": 80},
    "atún":              {"fdc_id": 173706, "num_medidas": 0.33, "medida": "tazas",  "masa_gr": 60}, #atún en agua
    "lomo vetado":       {"fdc_id": 174699, "num_medidas": 1, "medida": "trozos de 6x6x1",  "masa_gr": 50},
    "plateada":          {"fdc_id": 172159, "num_medidas": 1, "medida": "trozos de 6x6x1",  "masa_gr": 50},
    "chuleta de cordero":{"fdc_id": 172517, "num_medidas": 1, "medida": "trozos de 6x6x1",  "masa_gr": 50},
    # Carnes bajas en grasa
    "asiento picana vacuno": {"fdc_id": 169458, "num_medidas": 1, "medida": "trozos de 6x6x1",  "masa_gr": 50},
    "filete vacuno":     {"fdc_id": 173109, "num_medidas": 1, "medida": "trozos de 6x6x1",  "masa_gr": 50},
    "lomo liso vacuno":  {"fdc_id": 173107, "num_medidas": 1, "medida": "trozos de 6x6x1",  "masa_gr": 50},
    "filete cerdo":      {"fdc_id": 168312, "num_medidas": 1, "medida": "trozos de 6x6x1",  "masa_gr": 50},
    "pechuga pollo":     {"fdc_id": 171534, "num_medidas": 1, "medida": "trozos de 6x6x1",  "masa_gr": 50},
    # Legumbres (crudas)
    "porotos negros":    {"fdc_id": 173734, "num_medidas": 0.25, "medida": "tazas", "masa_gr": 50},
    "porotos blancos":   {"fdc_id": 175202, "num_medidas": 0.25, "medida": "tazas", "masa_gr": 50},
    "garbanzos":         {"fdc_id": 173756, "num_medidas": 0.25, "medida": "tazas", "masa_gr": 50},
    "lentejas":          {"fdc_id": 172420, "num_medidas": 0.25, "medida": "tazas", "masa_gr": 50},
    "arvejas secas":     {"fdc_id": 172428, "num_medidas": 0.25, "medida": "tazas", "masa_gr": 50},
    # Aceites y grasas
    "aceite de oliva":   {"fdc_id": 171413, "num_medidas": 4, "medida": "cucharaditas", "masa_gr": 20},
    "aceite de canola":  {"fdc_id": 172336, "num_medidas": 4, "medida": "cucharaditas", "masa_gr": 20},
    "aceite de maravilla":{"fdc_id": 172357,"num_medidas": 4, "medida": "cucharaditas", "masa_gr": 20},
    # Alimentos ricos en lípidos
    "almendras":         {"fdc_id": 170567, "num_medidas": 26, "medida": "unidades","masa_gr": 25},
    "maní sin sal":      {"fdc_id": 173807, "num_medidas": 30, "medida": "unidades","masa_gr": 30},
    "maní con sal":      {"fdc_id": 174261, "num_medidas": 30, "medida": "unidades","masa_gr": 30},
    "aceitunas":         {"fdc_id": 169094, "num_medidas": 11, "medida": "unidades","masa_gr": 55},
    "nueces":            {"fdc_id": 170186, "num_medidas": 5, "medida": "unidades","masa_gr": 25},
    # Azúcar
    "azúcar blanco":     {"fdc_id": 169655, "num_medidas": 1, "medida": "cucharaditas",   "masa_gr": 5},
    "miel":              {"fdc_id": 169640, "num_medidas": 1, "medida": "cucharaditas",   "masa_gr": 6},
    "mermelada":         {"fdc_id": 170280, "num_medidas": 1, "medida": "cucharaditas",   "masa_gr": 10},
    "manjar":            {"fdc_id": 2050855,"num_medidas": 1, "medida": "cucharaditas",   "masa_gr": 10},
    # Lácteos medios en grasa altos en carbohidratos
    "leche condensada":  {"fdc_id": 171275, "num_medidas": 2.5, "medida": "cucharadas",  "masa_gr": 50},
    "flan":              {"fdc_id": 167574, "num_medidas": 1, "medida": "unidades",  "masa_gr": 130},
    "yogurt griego":     {"fdc_id": 170905, "num_medidas": 1, "medida": "unidades",  "masa_gr": 175},
}
# ------------------------------------------------------------------------------------

# --- URL base ---
url_base_food = "https://api.nal.usda.gov/fdc/v1/food/"

# IDs de nutrientes de interés y mapeo a nombres de columna SQL-friendly
ids_nutrientes_interes = [1008, 1003, 1004, 1005, 1087, 1270, 1106, 1178, 1103, 1089, 1095, 1093, 1092]
nombres_columnas_es = {
    1008: "energia_kcal", 1003: "proteina_gr", 1004: "lipidos_gr",
    1005: "carbohidratos_gr", 1087: "calcio_mg", 1270: "omega3_gr",
    1106: "vitamina_a_mcg", 1178: "vitamina_b12_mcg", 1103: "selenio_mcg",
    1089: "hierro_mg", 1095: "zinc_mg", 1093: "sodio_mg", 1092: "potasio_mg",
}

# Nombres de todas las tablas a gestionar
TABLE_NAME_ALIMENTO = "alimento"
TABLE_NAME_NUTRICIONISTA = "nutricionista"
TABLE_NAME_PACIENTE = "paciente"
TABLE_NAME_CITA = "cita"
TABLE_NAME_DISPONIBILIDAD = "disponibilidad"
TABLE_NAME_ESPECIALIDAD = "especialidad"
TABLE_NAME_ESP_NUTRI = "especialidad_nutricionista"
TABLE_NAME_MINUTA = "minuta"
TABLE_NAME_TIEMPO_COMIDA = "tiempo_comida"
TABLE_NAME_GRUPO_ALIM = "grupo_alimenticio"
TABLE_NAME_DET_MINUTA = "detalle_minuta"
TABLE_NAME_ALIM_RECHAZO = "alimento_rechazo"
TABLE_NAME_CALC_ANTRO = "calculo_antropometria"
TABLE_NAME_ANTROPOMETRIA = "antropometria"
TABLE_NAME_DIAGNOSTICO = "diagnostico"
TABLE_NAME_DIAG_ANTRO = "diagnostico_antropometria"
TABLE_NAME_FACTOR_PAT = "factor_patologico"
TABLE_NAME_NIVEL_AF = "nivel_actividad_fisica"
TABLE_NAME_CALC_REQ = "calculo_requerimiento"
TABLE_NAME_REQUERIMIENTO = "requerimiento"
TABLE_NAME_ADEC_MINUTA = "calculo_adecuacion_minuta"
TABLE_NAME_ADEC_DIETA = "calculo_adecuacion_dieta"
TABLE_NAME_DIETA_DIARIA = "dieta_diaria"
TABLE_NAME_DET_DIETA = "detalle_dieta"

# Lista para almacenar los datos para el DataFrame 'alimento'
datos_alimentos_df = []
# DataFrame para los alimentos (se crea vacío o se llena)
df_alimentos = pd.DataFrame()

db_url = f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

try:
    engine = create_engine(db_url)
    print(f"\nConectando a la base de datos '{DB_NAME}' en {DB_HOST}...")
    inspector = inspect(engine)

    metadata = MetaData()
    
    alimento_table = Table(TABLE_NAME_ALIMENTO, metadata,
        Column('id_alimento', Integer, primary_key=True),
        Column('descripcion_alimento', String(50)),
        Column('num_medidas', Numeric(10, 2)),
        Column('medida', String(50)),
        Column('masa_gr', Numeric(10, 2)),
        # Definir columnas de nutrientes explícitamente basado en nombres_columnas_es
        *[Column(nombre, Numeric(12, 4)) for nombre in nombres_columnas_es.values()]
    )
    if not inspector.has_table(TABLE_NAME_ALIMENTO):
        print(f"La tabla alimento no existe. Definiendo estructura, creando e insertando...")
# --- Bloque de obtención de datos de la API ---
        for nombre_es_deseado, data_dict in alimentos_por_id.items():
            fdc_id = data_dict["fdc_id"]
            num_medidas = data_dict["num_medidas"]
            masa_gr = data_dict["masa_gr"]
            medida = data_dict["medida"] 

            print(f"\n-----------------------------------------------------")
            print(f"Procesando FDC ID: {fdc_id} (Para: '{nombre_es_deseado}')")
            url_food = f"{url_base_food}{fdc_id}?api_key={API_KEY}"

            try:
                response = requests.get(url_food, timeout=25)
                response.raise_for_status()
                alimento_data = response.json()
                info_nutrientes = {}
                nutrientes_encontrados_interes = 0
                if isinstance(alimento_data, dict) and 'foodNutrients' in alimento_data:
                    nutrientes_lista_api = alimento_data.get("foodNutrients", [])
                    if isinstance(nutrientes_lista_api, list):
                        for i, nutriente_item in enumerate(nutrientes_lista_api):
                            if isinstance(nutriente_item, dict):
                                nested_nutrient_dict = nutriente_item.get("nutrient")
                                if isinstance(nested_nutrient_dict, dict):
                                    nutrient_id_api = nested_nutrient_dict.get("id")
                                    if nutrient_id_api is not None:
                                        try:
                                            nutrient_id_int = int(nutrient_id_api)
                                            if nutrient_id_int in ids_nutrientes_interes:
                                                valor_api = nutriente_item.get("amount")
                                                valor_final = 0.0
                                                if valor_api is not None:
                                                    try: valor_final = float(valor_api)
                                                    except (ValueError, TypeError): valor_final = 0.0
                                                nombre_columna = nombres_columnas_es.get(nutrient_id_int)
                                                if nombre_columna:
                                                    info_nutrientes[nombre_columna] = valor_final
                                                    nutrientes_encontrados_interes += 1
                                        except (ValueError, TypeError): pass
                print(f"  Nutrientes de interés encontrados y procesados: {nutrientes_encontrados_interes}")
                datos_fila = {
                    "descripcion_alimento": nombre_es_deseado,
                    "num_medidas": num_medidas,
                    "medida": medida,
                    "masa_gr": masa_gr
                }
                for id_interes in ids_nutrientes_interes:
                    nombre_col = nombres_columnas_es.get(id_interes)
                    if nombre_col: datos_fila[nombre_col] = info_nutrientes.get(nombre_col, 0.0)
                datos_alimentos_df.append(datos_fila)
            except requests.exceptions.HTTPError as e_http:
                if e_http.response.status_code == 404: print(f"Error 404: No se encontró FDC ID '{fdc_id}'. Se omitirá.")
                else: print(f"Error HTTP {e_http.response.status_code} para FDC ID '{fdc_id}': {e_http}. Se omitirá.")
            except requests.exceptions.RequestException as e_req: print(f"Error de red para FDC ID '{fdc_id}': {e_req}. Se omitirá.")
            except json.JSONDecodeError as e_json: print(f"Error JSON para FDC ID '{fdc_id}': {e_json}. Se omitirá.")
            except Exception as e:
                import traceback
                print(f"Error inesperado procesando FDC ID '{fdc_id}': {e}")
                traceback.print_exc()
                print(f"Se omitirá el alimento {nombre_es_deseado}.")
        # -------------------------------------------------------

        # --- Crear DataFrame Final para Alimentos ---
        columnas_df_alimento = ["descripcion_alimento", "num_medidas", "medida", "masa_gr"] + \
                            [nombres_columnas_es[id_nut] for id_nut in ids_nutrientes_interes if id_nut in nombres_columnas_es]

        if datos_alimentos_df:
            df_alimentos = pd.DataFrame(datos_alimentos_df, columns=columnas_df_alimento)
            print(f"\nDataFrame de alimentos creado con {len(df_alimentos)} filas.")
            
            # --- Crear SOLO la tabla alimento usando su objeto Table ---
            try:
                print(f"Creando tabla '{TABLE_NAME_ALIMENTO}'...")
                alimento_table.create(bind=engine) # Llama a create() directamente
                print(f"Tabla '{TABLE_NAME_ALIMENTO}' creada.")

                # --- Insertar datos usando 'append' ---
                print(f"Insertando {len(df_alimentos)} filas de datos en '{TABLE_NAME_ALIMENTO}'...")
                df_alimentos.to_sql(TABLE_NAME_ALIMENTO, con=engine, if_exists='append', index=False)
                print(f"{len(df_alimentos)} filas insertadas correctamente.")
            except Exception as e_create_insert:
                 print(f"\nERROR al crear o insertar datos en tabla '{TABLE_NAME_ALIMENTO}': {e_create_insert}")
        else:
            print("\nNo se pudieron recopilar datos válidos para crear el DataFrame de alimentos.")
            
    else:
        # Si la tabla ya existe, no hacemos nada más con la BD
        print(f"La tabla '{TABLE_NAME_ALIMENTO}' ya existe. No se obtuvieron datos de API ni se insertaron datos.")
    # --- Definir Tabla Nutricionista ---
    tabla_nutricionista = Table(TABLE_NAME_NUTRICIONISTA, metadata,
        Column('id_nutricionista', Integer, primary_key=True),
        Column('rut_nutricionista', Integer, nullable=False),
        Column('dv', String(1), nullable=False),
        Column('primer_nombre', String(50), nullable=False),
        Column('segundo_nombre', String(50)),
        Column('apellido_paterno', String(50), nullable=False),
        Column('apellido_materno', String(50)),
        Column('fecha_nacimiento', Date),
        Column('correo', String(50), unique=True, nullable=False),
        Column('contrasena', String(128), nullable=False),
        Column('telefono', String(15)),
    )

    # --- Definir Tabla Paciente ---
    tabla_paciente = Table(TABLE_NAME_PACIENTE, metadata,
        Column('id_paciente', Integer, primary_key=True),
        Column('rut_paciente', Integer, nullable=False),
        Column('dv', String(1), nullable=False),
        Column('primer_nombre', String(50), nullable=False),
        Column('segundo_nombre', String(50)),
        Column('apellido_paterno', String(50), nullable=False),
        Column('apellido_materno', String(50)),
        Column('correo', String(50), unique=True, nullable=False),
        Column('contrasena', String(128), nullable=False),
        Column('fecha_nacimiento', Date, nullable=False),
        Column('telefono', String(15)),
        Column('sexo', String(1), nullable=False),
        Column('notas_varias', String(500)),
        Column('ocupacion', String(100)),
        Column('horario_laboral', String(50)),
        Column('conviviente', String(50)),
        Column('etapa_cambio_psicologico', String(100)),
        Column('antecedentes_morbidos', String(500)),
        Column('antecedentes_familiares', String(500)),
        Column('medicamentos_actuales', String(500)),
    )

    # --- Definir Tabla Cita ---
    tabla_cita = Table(TABLE_NAME_CITA, metadata,
        Column('id_cita', Integer, primary_key=True),
        Column('fecha_hora', DateTime, nullable=False),
        Column('estado', String(50), nullable=False),
        Column('motivo_consulta', String(200)),
        Column('hecho_relevante', String(500)),
        Column('compromiso_acordado', String(500)),
        Column('adherencia_medicamentos', String(500)),
        Column('id_paciente', Integer, ForeignKey(tabla_paciente.c.id_paciente)),
        Column('id_nutricionista', Integer, ForeignKey(tabla_nutricionista.c.id_nutricionista)),
    )
    
    # --- Definir Tabla Disponibilidad ---
    tabla_disponibilidad = Table(TABLE_NAME_DISPONIBILIDAD, metadata,
        Column('id_disponibilidad', Integer, primary_key=True),
        Column('fecha', Date, nullable=False),
        Column('hora_inicio', Time, nullable=False),
        Column('hora_fin', Time, nullable=False),
        Column('reservado', Boolean, nullable=False),
        Column('id_nutricionista', Integer, ForeignKey(tabla_nutricionista.c.id_nutricionista)),
    )
    
    # --- Definir Tabla Especialidad ---
    tabla_especialidad = Table(TABLE_NAME_ESPECIALIDAD, metadata,
        Column('id_especialidad', Integer, primary_key=True),
        Column('descripcion', String(100), nullable=False),
    )
    
    # --- Definir Tabla Especialidad_Nutricionista ---
    tabla_especialidad_nutricionista = Table(TABLE_NAME_ESP_NUTRI, metadata,
        Column('id_especialidad_nutricionista', Integer, primary_key=True),
        Column('id_nutricionista', Integer, ForeignKey(tabla_nutricionista.c.id_nutricionista)),
        Column('id_especialidad', Integer, ForeignKey(tabla_especialidad.c.id_especialidad)),
    )
    
    # --- Definir Tabla Minuta ---
    tabla_minuta = Table(TABLE_NAME_MINUTA, metadata,
        Column('id_minuta', Integer, primary_key=True),
        Column('fecha', Date, nullable=False),
    )
    
    # --- Definir Tabla Tiempo_comida ---
    tabla_tiempo_comida = Table(TABLE_NAME_TIEMPO_COMIDA, metadata,
        Column('id_tiempo_comida', Integer, primary_key=True),
        Column('descripcion', String(100), nullable=False),
        Column('hora_inicio', Time, nullable=False),
    )
    
    # --- Definir Tabla Grupo_Alimenticio ---
    tabla_grupo_alimenticio = Table(TABLE_NAME_GRUPO_ALIM, metadata,
        Column('id_grupo_alimenticio', Integer, primary_key=True),
        Column('descripcion', String(100), nullable=False),
        Column('aporte_calorico', Integer, nullable=False),
        Column('aporte_proteina', Integer, nullable=False),
        Column('aporte_lipidos', Integer, nullable=False),
        Column('aporte_carbohidratos', Integer, nullable=False),
    )
    
    # --- Definir Tabla Detalle_Minuta ---
    tabla_detalle_minuta = Table(TABLE_NAME_DET_MINUTA, metadata,
        Column('id_detalle_minuta', Integer, primary_key=True),
        Column('numero_porciones_grupo', Integer, nullable=False),
        Column('id_minuta', Integer, ForeignKey(tabla_minuta.c.id_minuta)),
        Column('id_tiempo_comida', Integer, ForeignKey(tabla_tiempo_comida.c.id_tiempo_comida)),
        Column('id_grupo_alimenticio', Integer, ForeignKey(tabla_grupo_alimenticio.c.id_grupo_alimenticio)),
    )
    
    # --- Definir Tabla Alimento_Rechazo ---
    tabla_alimento_rechazo = Table(TABLE_NAME_ALIM_RECHAZO, metadata,
        Column('id_alimento_rechazado', Integer, primary_key=True),
        Column('motivo_rechazo', String(100), nullable=False),
        Column('id_paciente', Integer, ForeignKey(tabla_paciente.c.id_paciente)),
    )
    
    # --- Definir Tabla Calculo_Antropometria ---
    tabla_calculo_antropometria = Table(TABLE_NAME_CALC_ANTRO, metadata,
        Column('id_calculo_antropometria', Integer, primary_key=True),
        Column('imc', Float),
        Column('indice_cintura_talla', Float),
        Column('area_grasa_braquial', Float),
        Column('area_muscular_braquial', Float),
        Column('perimetro_muscular_braquial', Float),
        Column('porc_grasa', Float),
    )
    
    # --- Definir Tabla Antropometria ---
    tabla_antropometria = Table(TABLE_NAME_ANTROPOMETRIA, metadata,
        Column('fecha', Date, nullable=False),
        Column('peso', Float, nullable=False),
        Column('talla', Float, nullable=False),
        Column('circunferencia_cintura', Float, nullable=False),
        Column('perimetro_braquial', Float, nullable=False),
        Column('pliegue_tricipital', Float, nullable=False),
        Column('pliegue_bicipital', Float, nullable=False),
        Column('pliegue_suprailiaco', Float, nullable=False),
        Column('pliegue_subescapular', Float, nullable=False),
        Column('id_paciente', Integer, ForeignKey(tabla_paciente.c.id_paciente)),
        Column('id_calculo_antropometria', Integer, ForeignKey(tabla_calculo_antropometria.c.id_calculo_antropometria)),
    )
    
    # --- Definir Tabla Diagnostico ---
    tabla_diagnostico = Table(TABLE_NAME_DIAGNOSTICO, metadata,
        Column('id_diagnostico', Integer, primary_key=True),
        Column('descripcion', String(100), nullable=False),
    )
    
    # --- Definir Tabla Diagnostico_antropometria ---
    tabla_diagnostico_antropometria = Table(TABLE_NAME_DIAG_ANTRO, metadata,
        Column('id_diagnostico_antropometria', Integer, primary_key=True),
        Column('id_diagnostico', Integer, ForeignKey(tabla_diagnostico.c.id_diagnostico)),
        Column('id_calculo_antropometria', Integer, ForeignKey(tabla_calculo_antropometria.c.id_calculo_antropometria)),
    )
    
    # --- Definir Tabla Factor_Patologico ---
    tabla_factor_patologico = Table(TABLE_NAME_FACTOR_PAT, metadata,
        Column('id_factor_patologico', Integer, primary_key=True),
        Column('descripcion', String(100), nullable=False),
        Column('valor_factor', Float, nullable=False),
    )
    
    # --- Definir Tabla Nivel_Actividad_Fisica ---
    tabla_nivel_actividad_fisica = Table(TABLE_NAME_NIVEL_AF, metadata,
        Column('id_nivel_actividad_fisica', Integer, primary_key=True),
        Column('descripcion', String(100), nullable=False),
        Column('valor_factor', Float, nullable=False),
    )
    
    # --- Definir Tabla Calculo_Requerimiento ---
    tabla_calculo_requerimiento = Table(TABLE_NAME_CALC_REQ, metadata,
        Column('id_calculo_requerimiento', Integer, primary_key=True),
        Column('semana_gestacion', Integer),
        Column('valor_factor', Float, nullable=False),
        Column('condicion_embarazo', Boolean, nullable=False),
        Column('id_nivel_actividad_fisica', Integer, ForeignKey(tabla_nivel_actividad_fisica.c.id_nivel_actividad_fisica)),
        Column('id_factor_patologico', Integer, ForeignKey(tabla_factor_patologico.c.id_factor_patologico)),
        Column('id_requerimiento', Integer, ForeignKey(f'{TABLE_NAME_REQUERIMIENTO}.id_requerimiento',deferrable=True, initially='DEFERRED')),
        Column('id_paciente', Integer, ForeignKey(tabla_paciente.c.id_paciente)),
        Column('id_nutricionista', Integer, ForeignKey(tabla_nutricionista.c.id_nutricionista)),
    )

    # --- Definir Tabla Requerimiento ---
    tabla_requerimiento = Table(TABLE_NAME_REQUERIMIENTO, metadata,
        Column('id_requerimiento', Integer, primary_key=True),
        Column('requerimiento_calorico', Float, nullable=False),
        Column('requerimiento_proteinas', Float, nullable=False),
        Column('requerimiento_carbohidratos', Float, nullable=False),
        Column('requerimiento_lipidos', Float, nullable=False),
        Column('requerimiento_n3', Float),
        Column('requerimiento_vit_a', Float),
        Column('requerimiento_vit_b12', Float),
        Column('requerimiento_calcio', Float),
        Column('requerimiento_hierro', Float),
        Column('requerimiento_selenio', Float),
        Column('requerimiento_zinc', Float),
        Column('requerimiento_potasio', Float),
        Column('requerimiento_sodio', Float),
        Column('condicion_embarazo', Boolean, nullable=False),
        Column('id_calculo_requerimiento', Integer, ForeignKey(f'{TABLE_NAME_CALC_REQ}.id_calculo_requerimiento',deferrable=True, initially='DEFERRED')),
        Column('id_adecuacion_dieta', Integer, ForeignKey(f'{TABLE_NAME_ADEC_DIETA}.id_adecuacion_dieta',deferrable=True, initially='DEFERRED')),
    )

    # --- Definir Tabla Calculo_Adecuacion_Minuta ---
    tabla_adecuacion_minuta = Table(TABLE_NAME_ADEC_MINUTA, metadata,
        Column('id_adecuacion_minuta', Integer, primary_key=True),
        Column('porc_adec_calorico', Float, nullable=False),
        Column('porc_adec_proteinas', Float, nullable=False),
        Column('porc_adec_carbohidratos', Float, nullable=False),
        Column('porc_adec_lipidos', Float, nullable=False),
        Column('id_requerimiento', Integer, ForeignKey(f'{TABLE_NAME_REQUERIMIENTO}.id_requerimiento',deferrable=True, initially='DEFERRED')),
    )
    
    # --- Definir Tabla Calculo_Adecuacion_Dieta ---
    tabla_adecuacion_dieta = Table(TABLE_NAME_ADEC_DIETA, metadata,
        Column('id_adecuacion_dieta', Integer, primary_key=True),
        Column('porc_adec_calorico', Float, nullable=False),
        Column('porc_adec_proteinas', Float, nullable=False),
        Column('porc_adec_carbohidratos', Float, nullable=False),
        Column('porc_adec_lipidos', Float, nullable=False),
        Column('porc_adec_n3', Float),
        Column('porc_adec_vit_a', Float),
        Column('porc_adec_vit_b12', Float),
        Column('porc_adec_calcio', Float),
        Column('porc_adec_hierro', Float),
        Column('porc_adec_selenio', Float),
        Column('porc_adec_zinc', Float),
        Column('porc_adec_potasio', Float),
        Column('porc_adec_sodio', Float),
        Column('id_requerimiento', Integer, ForeignKey(f'{TABLE_NAME_REQUERIMIENTO}.id_requerimiento',deferrable=True, initially='DEFERRED')),
        Column('id_dieta_diaria', Integer, ForeignKey(f'{TABLE_NAME_DIETA_DIARIA}.id_dieta_diaria',deferrable=True, initially='DEFERRED')),
    )
    
    # --- Definir Tabla Dieta_Diaria ---
    tabla_dieta_diaria = Table(TABLE_NAME_DIETA_DIARIA, metadata,
        Column('id_dieta_diaria', Integer, primary_key=True),
        Column('aporte_calorico', Float, nullable=False),
        Column('aporte_proteinas', Float, nullable=False),
        Column('aporte_carbohidratos', Float, nullable=False),
        Column('aporte_lipidos', Float, nullable=False),
        Column('aporte_n3', Float),
        Column('aporte_vit_a', Float),
        Column('aporte_vit_b12', Float),
        Column('aporte_calcio', Float),
        Column('aporte_hierro', Float),
        Column('aporte_selenio', Float),
        Column('aporte_zinc', Float),
        Column('aporte_potasio', Float),
        Column('aporte_sodio', Float),
        Column('id_paciente', Integer, ForeignKey(tabla_paciente.c.id_paciente)),
    )

    # --- Definir Tabla Detalle_Dieta ---
    tabla_detalle_dieta = Table(TABLE_NAME_DET_DIETA, metadata,
        Column('id_detalle_dieta', Integer, primary_key=True),
        Column('id_dieta_diaria', Integer, ForeignKey(tabla_dieta_diaria.c.id_dieta_diaria)),
        Column('id_alimento', Integer, ForeignKey(f'{TABLE_NAME_ALIMENTO}.id_alimento',deferrable=True, initially='DEFERRED')),
    )
    
    # --- Crear todas las tablas definidas en metadata SI NO EXISTEN ---
    print("\nVerificando y creando OTRAS tablas si no existen...")    
    metadata.create_all(engine) 
    print("Verificación/Creación de tablas completada.")

except ImportError as e:
        print(f"\nERROR de Importación: {e}")
        print("Verifica que las variables de config (DB_USER, etc.) estén definidas")
        print("Y que las librerías 'sqlalchemy' y 'psycopg2-binary' estén instaladas.")
except Exception as e_db:
    print(f"\nERROR al conectar o interactuar con la base de datos: {e_db}")

print("\nScript finalizado.")