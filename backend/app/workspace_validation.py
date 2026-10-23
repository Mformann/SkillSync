"""One validation contract for JSON workspace requests and multipart uploads."""
from typing import Annotated

from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, ConfigDict, StrictBool, StringConstraints, ValidationError, field_validator

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=160)]
Description = Annotated[str, StringConstraints(strip_whitespace=True, min_length=50, max_length=50_000)]
ShortText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=160)]
EmploymentType = Annotated[str, StringConstraints(strip_whitespace=True, max_length=80)]


class WorkspaceFields(BaseModel):
    model_config = ConfigDict(extra="forbid")

    @field_validator("company", "location", "employment_type", mode="before", check_fields=False)
    @classmethod
    def clear_blank_optional_text(cls, value):
        return None if isinstance(value, str) and not value.strip() else value


class WorkspaceCreate(WorkspaceFields):
    title: Title
    company: ShortText | None = None
    description: Description
    location: ShortText | None = None
    employment_type: EmploymentType | None = None
    ai_consent: StrictBool = False


class WorkspaceUpdate(WorkspaceFields):
    title: Title | None = None
    company: ShortText | None = None
    description: Description | None = None
    location: ShortText | None = None
    employment_type: EmploymentType | None = None
    is_archived: StrictBool | None = None
    ai_consent: StrictBool | None = None

    @field_validator("title", "description", "is_archived", "ai_consent", mode="before")
    @classmethod
    def required_fields_cannot_be_cleared(cls, value):
        # Defaults are not validated: omission remains distinct from explicit null.
        if value is None:
            raise ValueError("This field cannot be null.")
        return value


def validate_upload_fields(values, *, updating):
    try:
        return (WorkspaceUpdate if updating else WorkspaceCreate).model_validate(values)
    except ValidationError as exc:
        names = {"title": "job_role", "description": "job_description"}
        errors = []
        for error in exc.errors(include_input=False, include_url=False):
            error.pop("ctx", None)
            location = error.get("loc", ())
            error["loc"] = ("body", names.get(location[0], location[0]), *location[1:])
            errors.append(error)
        raise RequestValidationError(errors) from exc
