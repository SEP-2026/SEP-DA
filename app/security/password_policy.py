import re
from typing import Final

from fastapi import HTTPException, status

PASSWORD_MIN_LENGTH: Final[int] = 8
PASSWORD_MAX_LENGTH: Final[int] = 128
PASSWORD_POLICY_MESSAGE: Final[str] = (
    "Mật khẩu phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt"
)

_LOWERCASE_RE = re.compile(r"[a-z]")
_UPPERCASE_RE = re.compile(r"[A-Z]")
_DIGIT_RE = re.compile(r"\d")
_SPECIAL_RE = re.compile(r"[^A-Za-z0-9]")


def is_strong_password(password: str) -> bool:
    if len(password) < PASSWORD_MIN_LENGTH or len(password) > PASSWORD_MAX_LENGTH:
        return False
    return bool(
        _LOWERCASE_RE.search(password)
        and _UPPERCASE_RE.search(password)
        and _DIGIT_RE.search(password)
        and _SPECIAL_RE.search(password)
    )


def ensure_strong_password(password: str) -> None:
    if not is_strong_password(password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=PASSWORD_POLICY_MESSAGE)
