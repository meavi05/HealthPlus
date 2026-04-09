Use this folder to validate the V29 standardized schema path without changing existing environments.

How to run with this schema path:

```bash
SPRING_PROFILES_ACTIVE=v29 ./mvnw spring-boot:run
```

Optional custom DB file:

```bash
SPRING_PROFILES_ACTIVE=v29 \
V29_DB_URL=jdbc:sqlite:/absolute/path/health_plus_store_v29.db \
./mvnw spring-boot:run
```

Notes:
- This path uses `flyway_schema_history_v29` so it does not conflict with existing Flyway history.
- The baseline schema keeps legacy tables for backward compatibility and includes new V29 stock tables/views.
- Quantity/UOM compatibility updates are in `V2` and `V3` for OCR + sales stock math fields.
- Do not delete `db/migration` until all code paths are moved to the new architecture and validated.
