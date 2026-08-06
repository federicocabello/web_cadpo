# Importador CADPO

Aplicación de escritorio independiente para cargas masivas en `web_cadpo`.

## Preparación

Requiere Python 3.10 o posterior.

```powershell
py -m pip install -r requirements.txt
```

## Inicio

Abrir `iniciar.bat` o ejecutar:

```powershell
py main.py
```

La conexión se configura en `database.py` y se comprueba automáticamente al
iniciar. El área de trabajo se habilita únicamente después de conectar con MySQL.

Los valores también pueden sobrescribirse con estas variables de entorno:

- `CADPO_DB_HOST`
- `CADPO_DB_PORT`
- `CADPO_DB_USER`
- `CADPO_DB_PASSWORD`
- `CADPO_DB_NAME`
