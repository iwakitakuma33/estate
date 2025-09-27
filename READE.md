
docker compose --file local.compose.yaml build
docker compose --file local.compose.yaml up -d

docker exec -it estate-frontend-1 /bin/bash
bun run dev

docker exec -it estate-web-1 /bin/bash
uvicorn main:app --host 0.0.0.0 --port 80
