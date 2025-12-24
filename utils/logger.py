"""
Logging infrastructure for JARVIS
Provides consistent logging across all modules with file and console output
"""
import logging
import sys
from pathlib import Path
from logging.handlers import RotatingFileHandler
from typing import Optional
from rich.logging import RichHandler
from rich.console import Console

# Global logger registry
_loggers: dict[str, logging.Logger] = {}
_initialized = False


def setup_logging(
    log_level: str = "INFO",
    log_dir: Optional[Path] = None,
    log_to_file: bool = True,
    log_to_console: bool = True,
    max_bytes: int = 10 * 1024 * 1024,  # 10 MB
    backup_count: int = 5
) -> None:
    """
    Setup global logging configuration
    
    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR)
        log_dir: Directory for log files
        log_to_file: Enable file logging
        log_to_console: Enable console logging
        max_bytes: Maximum log file size before rotation
        backup_count: Number of backup files to keep
    """
    global _initialized
    
    if _initialized:
        return
    
    # Create log directory if needed
    if log_to_file and log_dir:
        log_dir.mkdir(parents=True, exist_ok=True)
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level.upper()))
    
    # Remove existing handlers
    root_logger.handlers.clear()
    
    # Format for logs
    file_formatter = logging.Formatter(
        fmt="%(asctime)s | %(name)-20s | %(levelname)-8s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    
    # Console handler with Rich
    if log_to_console:
        console_handler = RichHandler(
            console=Console(stderr=True),
            show_time=True,
            show_path=False,
            markup=True,
            rich_tracebacks=True,
            tracebacks_show_locals=True
        )
        console_handler.setLevel(getattr(logging, log_level.upper()))
        root_logger.addHandler(console_handler)
    
    # File handler with rotation
    if log_to_file and log_dir:
        log_file = log_dir / "jarvis.log"
        file_handler = RotatingFileHandler(
            log_file,
            maxBytes=max_bytes,
            backupCount=backup_count,
            encoding="utf-8"
        )
        file_handler.setLevel(logging.DEBUG)  # Always log everything to file
        file_handler.setFormatter(file_formatter)
        root_logger.addHandler(file_handler)
    
    _initialized = True
    
    # Log initialization
    logger = get_logger("jarvis.logging")
    logger.info(f"Logging initialized: level={log_level}, file={log_to_file}, console={log_to_console}")


def get_logger(name: str) -> logging.Logger:
    """
    Get or create a logger with the given name
    
    Args:
        name: Logger name (typically module name)
    
    Returns:
        Configured logger instance
    """
    if name not in _loggers:
        _loggers[name] = logging.getLogger(name)
    
    return _loggers[name]


def set_log_level(level: str) -> None:
    """
    Change the log level for all loggers
    
    Args:
        level: New log level (DEBUG, INFO, WARNING, ERROR)
    """
    log_level = getattr(logging, level.upper())
    logging.getLogger().setLevel(log_level)
    
    for handler in logging.getLogger().handlers:
        if isinstance(handler, RichHandler):
            handler.setLevel(log_level)
