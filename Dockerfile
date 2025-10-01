FROM oven/bun:latest

WORKDIR /app

EXPOSE 3111

# 依存関係のインストール
COPY package.json bun.lock ./
RUN bun install

# アプリケーションの起動
# CMD ["bun", "run", "dev"]
CMD ["tail", "-f", "/dev/null"]
