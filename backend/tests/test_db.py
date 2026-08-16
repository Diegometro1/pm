import tempfile
from pathlib import Path
from backend import db


def test_init_and_save_load():
    with tempfile.TemporaryDirectory() as td:
        db_path = Path(td) / "pm.db"
        db.init_db(db_path)
        assert db_path.exists()

        user_id = "user"
        board = {"id": "b1", "title": "T", "columns": [], "cards": {}}
        db.save_board(db_path, user_id, board)

        loaded = db.get_board(db_path, user_id)
        assert loaded is not None
        assert loaded["id"] == "b1"
