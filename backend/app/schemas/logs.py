from pydantic import BaseModel, ConfigDict
from typing import Optional

class ClientLogIn(BaseModel):
    level: str
    message: str
    context: Optional[str] = None

class ClientLogOut(BaseModel):
    id: int
    level: str
    message: str
    context: str | None

    model_config = ConfigDict(from_attributes=True)
