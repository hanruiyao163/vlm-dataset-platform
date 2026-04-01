from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import DATABASE_URL


class Base(DeclarativeBase):
    pass


engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def ensure_schema():
    inspector = inspect(engine)
    with engine.begin() as connection:
        if inspector.has_table("settings"):
            existing_columns = {column["name"] for column in inspector.get_columns("settings")}
            if "available_models_text" not in existing_columns:
                connection.execute(
                    text("ALTER TABLE settings ADD COLUMN available_models_text TEXT NOT NULL DEFAULT ''")
                )
            if "model_profiles_json" not in existing_columns:
                connection.execute(
                    text("ALTER TABLE settings ADD COLUMN model_profiles_json TEXT NOT NULL DEFAULT '[]'")
                )
        if inspector.has_table("projects"):
            project_columns = {column["name"] for column in inspector.get_columns("projects")}
            if "default_description_prompt" not in project_columns:
                connection.execute(
                    text("ALTER TABLE projects ADD COLUMN default_description_prompt TEXT NOT NULL DEFAULT ''")
                )
            if "default_question_prompt" not in project_columns:
                connection.execute(
                    text("ALTER TABLE projects ADD COLUMN default_question_prompt TEXT NOT NULL DEFAULT ''")
                )
        if inspector.has_table("batches"):
            batch_columns = {column["name"] for column in inspector.get_columns("batches")}
            if "default_description_prompt" not in batch_columns:
                connection.execute(
                    text("ALTER TABLE batches ADD COLUMN default_description_prompt TEXT NOT NULL DEFAULT ''")
                )
            if "default_question_prompt" not in batch_columns:
                connection.execute(
                    text("ALTER TABLE batches ADD COLUMN default_question_prompt TEXT NOT NULL DEFAULT ''")
                )
        if inspector.has_table("description_generations"):
            description_columns = {column["name"] for column in inspector.get_columns("description_generations")}
            if "paired_question_id" not in description_columns:
                connection.execute(
                    text("ALTER TABLE description_generations ADD COLUMN paired_question_id INTEGER")
                )
            if "question_id" in description_columns:
                connection.execute(
                    text(
                        """
                        UPDATE description_generations
                        SET paired_question_id = question_id
                        WHERE paired_question_id IS NULL AND question_id IS NOT NULL
                        """
                    )
                )
                connection.execute(text("PRAGMA foreign_keys=OFF"))
                connection.execute(
                    text(
                        """
                        CREATE TABLE description_generations__new (
                            id INTEGER NOT NULL PRIMARY KEY,
                            image_id INTEGER NOT NULL,
                            paired_question_id INTEGER,
                            prompt TEXT NOT NULL,
                            model VARCHAR(200) NOT NULL DEFAULT '',
                            content TEXT NOT NULL DEFAULT '',
                            status VARCHAR(30) NOT NULL DEFAULT 'pending',
                            error TEXT NOT NULL DEFAULT '',
                            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY(image_id) REFERENCES images (id),
                            FOREIGN KEY(paired_question_id) REFERENCES question_generations (id)
                        )
                        """
                    )
                )
                connection.execute(
                    text(
                        """
                        INSERT INTO description_generations__new (
                            id, image_id, paired_question_id, prompt, model, content, status, error, created_at
                        )
                        SELECT
                            id,
                            image_id,
                            COALESCE(paired_question_id, question_id),
                            prompt,
                            model,
                            content,
                            status,
                            error,
                            created_at
                        FROM description_generations
                        """
                    )
                )
                connection.execute(text("DROP TABLE description_generations"))
                connection.execute(text("ALTER TABLE description_generations__new RENAME TO description_generations"))
                connection.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS ix_description_generations_image_id ON description_generations (image_id)"
                    )
                )
                connection.execute(text("PRAGMA foreign_keys=ON"))
        if inspector.has_table("generation_events"):
            event_count = connection.execute(text("SELECT COUNT(*) FROM generation_events")).scalar() or 0
            if event_count == 0:
                connection.execute(
                    text(
                        """
                        INSERT INTO generation_events (
                            project_id, batch_id, image_id, task_type, source_record_id, prompt, model, status, content, error, created_at
                        )
                        SELECT
                            images.project_id,
                            images.batch_id,
                            description_generations.image_id,
                            'description',
                            description_generations.id,
                            description_generations.prompt,
                            description_generations.model,
                            description_generations.status,
                            description_generations.content,
                            description_generations.error,
                            description_generations.created_at
                        FROM description_generations
                        JOIN images ON images.id = description_generations.image_id
                        WHERE description_generations.status = 'success'
                        """
                    )
                )
                connection.execute(
                    text(
                        """
                        INSERT INTO generation_events (
                            project_id, batch_id, image_id, task_type, source_record_id, prompt, model, status, content, error, created_at
                        )
                        SELECT
                            images.project_id,
                            images.batch_id,
                            question_generations.image_id,
                            'question',
                            question_generations.id,
                            question_generations.prompt,
                            question_generations.model,
                            question_generations.status,
                            question_generations.content,
                            question_generations.error,
                            question_generations.created_at
                        FROM question_generations
                        JOIN images ON images.id = question_generations.image_id
                        WHERE question_generations.status = 'success'
                        """
                    )
                )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
