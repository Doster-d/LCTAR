from pydantic import BaseModel, ConfigDict


class ClientLogIn(BaseModel):
    level: str
    message: str
    context: str | None = None


class ClientLogOut(BaseModel):
    id: int
    level: str
    message: str
    context: str | None

    model_config = ConfigDict(from_attributes=True)
