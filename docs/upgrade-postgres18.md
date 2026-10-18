# PostgreSQL 18 升级

Compose 现在使用 PostgreSQL 18.6 和独立卷 `postgres18_data`，挂载到官方镜像要求的 `/var/lib/postgresql`；实际 PGDATA 为 `/var/lib/postgresql/18/docker`。旧 PostgreSQL 17 的 `postgres_data` 卷保留在本机，不会自动转换或删除。

全新开发环境按 README 快速开始即可。已有数据库需要先导出，再切到 18 恢复；只运行 `pnpm db:migrate` 不会搬迁旧卷数据。

## 保留现有数据

以下是手动迁移步骤，仅在准备启动 Docker 和迁移数据时执行。本次代码升级没有执行这些操作。

1. 停止 API、Worker、Eve 和其他写入方，让旧 PostgreSQL 17 保持运行。
2. 导出旧数据库，并确认导出成功、文件非空。下面假设旧服务仍叫 `postgres`，数据库沿用模板默认值：

   ```bash
   docker compose exec -T postgres pg_dump -U project_template -d project_template -Fc > postgres17.dump
   test -s postgres17.dump
   ```

3. 停止旧 PostgreSQL，使用新 Compose 启动 PostgreSQL 18。新卷会初始化一个空数据库：

   ```bash
   docker compose stop postgres
   docker compose up -d postgres
   docker compose exec postgres pg_isready -U project_template -d project_template
   ```

4. 就绪后恢复到新数据库，并应用已提交 migration：

   ```bash
   docker compose exec -T postgres pg_restore -U project_template -d project_template --exit-on-error --no-owner --no-privileges < postgres17.dump
   pnpm --filter @agent-template/db exec prisma migrate deploy
   ```

5. 核对表和关键记录后，再启动应用。保留 dump 与旧卷，直到数据核对完成。

已有服务已被新版替换时，可用旧 `postgres:17-alpine` 镜像单独挂载原卷到 `/var/lib/postgresql/data`，恢复旧数据库后再导出。Compose 默认项目名为 `agent-template`，旧卷通常名为 `agent-template_postgres_data`；自定义项目名时以实际卷名为准。不要将 17 数据目录直接挂载给 18。

回退时停掉 PostgreSQL 18，将镜像恢复为 17，并将原 `postgres_data` 卷挂回 `/var/lib/postgresql/data`。回退只包含迁移前旧卷里的数据，新库后续写入需要另行处理。

仅需模板示例数据时，也可以在新库运行 README 中的 migrate 和 seed，旧库无需删除。不要运行 `docker compose down -v` 来完成版本升级。
