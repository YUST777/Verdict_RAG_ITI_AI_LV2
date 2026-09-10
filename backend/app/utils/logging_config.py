import logging
import sys

def configure_logging(level: int = logging.INFO) -> logging.Logger:
    """Configure structured logging for the FastAPI RAG backend."""
    logger = logging.getLogger("verdict_rag")
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter(
            "%(asctime)s [%(levelname)s] %(name)s (%(filename)s:%(lineno)d): %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    logger.setLevel(level)
    return logger
