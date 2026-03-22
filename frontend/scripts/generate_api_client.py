#!/usr/bin/env python
from __future__ import annotations

import json
import re
from collections import OrderedDict
from pathlib import Path
from typing import Any

try:
    import yaml
except ModuleNotFoundError:  # pragma: no cover - exercised in CI environments without PyYAML
    yaml = None


HTTP_METHODS = ("get", "post", "put", "patch", "delete", "options", "head")
PRIMITIVE_TS_TYPES = {
    "string": "string",
    "integer": "number",
    "number": "number",
    "boolean": "boolean",
}
TS_RESERVED_WORDS = {
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "debugger",
    "default",
    "delete",
    "do",
    "else",
    "enum",
    "export",
    "extends",
    "false",
    "finally",
    "for",
    "function",
    "if",
    "import",
    "in",
    "instanceof",
    "new",
    "null",
    "return",
    "super",
    "switch",
    "this",
    "throw",
    "true",
    "try",
    "typeof",
    "var",
    "void",
    "while",
    "with",
    "as",
    "implements",
    "interface",
    "let",
    "package",
    "private",
    "protected",
    "public",
    "static",
    "yield",
    "any",
    "await",
    "boolean",
    "constructor",
    "declare",
    "get",
    "module",
    "require",
    "number",
    "set",
    "string",
    "symbol",
    "type",
    "from",
    "of",
}


def ref_name(ref: str) -> str:
    return ref.rsplit("/", 1)[-1]


def is_identifier(value: str) -> bool:
    return bool(re.match(r"^[A-Za-z_]\w*$", value))


def to_literal(value: Any) -> str:
    if isinstance(value, str):
        return json.dumps(value)
    if value is None:
        return "null"
    if value is True:
        return "true"
    if value is False:
        return "false"
    return str(value)


def to_property_key(value: str) -> str:
    if is_identifier(value) and value not in TS_RESERVED_WORDS:
        return value
    return json.dumps(value)


def to_camel_case(value: str) -> str:
    chunks = [chunk for chunk in re.split(r"[^A-Za-z0-9]+", value) if chunk]
    if not chunks:
        return "value"
    first = chunks[0]
    result = first[:1].lower() + first[1:]
    for chunk in chunks[1:]:
        result += chunk[:1].upper() + chunk[1:]
    if result[:1].isdigit():
        result = f"value{result}"
    if result in TS_RESERVED_WORDS:
        result = f"{result}Value"
    return result


def to_pascal_case(value: str) -> str:
    spaced = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", value)
    chunks = [chunk for chunk in re.split(r"[^A-Za-z0-9]+", spaced) if chunk]
    if not chunks:
        return "Operation"
    return "".join(chunk[:1].upper() + chunk[1:] for chunk in chunks)


def with_nullable(schema: dict[str, Any], base_type: str) -> str:
    if schema.get("nullable"):
        return f"{base_type} | null"
    return base_type


def to_ts_type(schema: dict[str, Any] | None) -> str:
    if not isinstance(schema, dict):
        return "unknown"

    if "$ref" in schema:
        return with_nullable(schema, ref_name(str(schema["$ref"])))

    if "const" in schema:
        return with_nullable(schema, to_literal(schema["const"]))

    if "enum" in schema and isinstance(schema["enum"], list):
        enum_union = " | ".join(to_literal(item) for item in schema["enum"])
        return with_nullable(schema, enum_union or "never")

    if "oneOf" in schema and isinstance(schema["oneOf"], list):
        one_of_union = " | ".join(to_ts_type(item) for item in schema["oneOf"])
        return with_nullable(schema, one_of_union or "unknown")

    if "anyOf" in schema and isinstance(schema["anyOf"], list):
        any_of_union = " | ".join(to_ts_type(item) for item in schema["anyOf"])
        return with_nullable(schema, any_of_union or "unknown")

    if "allOf" in schema and isinstance(schema["allOf"], list):
        all_of_union = " & ".join(to_ts_type(item) for item in schema["allOf"])
        return with_nullable(schema, all_of_union or "unknown")

    schema_type = schema.get("type")
    if schema_type in PRIMITIVE_TS_TYPES:
        return with_nullable(schema, PRIMITIVE_TS_TYPES[str(schema_type)])

    if schema_type == "array":
        items_type = to_ts_type(schema.get("items"))
        return with_nullable(schema, f"{items_type}[]")

    if schema_type == "object" or "properties" in schema:
        properties = schema.get("properties") or {}
        required = set(schema.get("required") or [])
        if isinstance(properties, dict) and properties:
            members: list[str] = []
            for prop_name, prop_schema in properties.items():
                optional = "" if prop_name in required else "?"
                members.append(f"{to_property_key(str(prop_name))}{optional}: {to_ts_type(prop_schema)}")
            return with_nullable(schema, "{ " + "; ".join(members) + "; }")
        additional = schema.get("additionalProperties")
        if additional is True:
            return with_nullable(schema, "Record<string, unknown>")
        if isinstance(additional, dict):
            return with_nullable(schema, f"Record<string, {to_ts_type(additional)}>")
        return with_nullable(schema, "Record<string, unknown>")

    return with_nullable(schema, "unknown")


def resolve_parameter(parameter: dict[str, Any], components: dict[str, Any]) -> dict[str, Any]:
    if "$ref" not in parameter:
        return parameter
    resolved = components.get("parameters", {}).get(ref_name(str(parameter["$ref"])))
    if not isinstance(resolved, dict):
        raise ValueError(f"Unable to resolve parameter reference: {parameter['$ref']}")
    return resolved


def first_json_schema(content: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(content, dict):
        return None
    if "application/json" in content:
        media = content["application/json"]
        if isinstance(media, dict):
            return media.get("schema")
    for media in content.values():
        if isinstance(media, dict) and "schema" in media:
            return media["schema"]
    return None


def success_response_schema(responses: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(responses, dict):
        return None
    candidates: list[tuple[int, str, dict[str, Any]]] = []
    for code, response in responses.items():
        code_str = str(code)
        if not code_str.startswith("2"):
            continue
        if not isinstance(response, dict):
            continue
        parsed = int(code_str) if code_str.isdigit() else 999
        candidates.append((parsed, code_str, response))
    if not candidates:
        return None
    _, _, chosen = sorted(candidates, key=lambda item: item[0])[0]
    return first_json_schema(chosen.get("content"))


def normalize_parameters(
    path_parameters: list[dict[str, Any]],
    operation_parameters: list[dict[str, Any]],
    components: dict[str, Any],
) -> list[dict[str, Any]]:
    merged: "OrderedDict[tuple[str, str], dict[str, Any]]" = OrderedDict()
    for raw in path_parameters + operation_parameters:
        resolved = resolve_parameter(raw, components)
        param_in = str(resolved.get("in", ""))
        param_name = str(resolved.get("name", ""))
        merged[(param_in, param_name)] = resolved
    return list(merged.values())


def render(spec: dict[str, Any], source_label: str) -> str:
    if not isinstance(spec, dict):
        raise ValueError(f"Invalid OpenAPI document loaded from {source_label}")

    components = spec.get("components") or {}
    schemas = components.get("schemas") or {}
    paths = spec.get("paths") or {}

    lines: list[str] = []
    lines.append("// AUTO-GENERATED FILE. DO NOT EDIT.")
    lines.append("// Source: packages/shared/openapi/openapi.yaml")
    lines.append("// Generator: frontend/scripts/generate_api_client.py")
    lines.append("")
    lines.append('import type { AxiosInstance, AxiosRequestConfig } from "axios";')
    lines.append("")

    for schema_name, schema in schemas.items():
        lines.append(f"export type {schema_name} = {to_ts_type(schema)};")
    lines.append("")

    operations: list[dict[str, Any]] = []
    for path, path_item in paths.items():
        if not isinstance(path_item, dict):
            continue
        path_parameters = path_item.get("parameters") or []
        for method in HTTP_METHODS:
            operation = path_item.get(method)
            if not isinstance(operation, dict):
                continue
            operation_id = operation.get("operationId")
            if not isinstance(operation_id, str) or not operation_id:
                raise ValueError(f"Missing operationId for {method.upper()} {path}")
            operation_parameters = operation.get("parameters") or []
            parameters = normalize_parameters(path_parameters, operation_parameters, components)

            parameter_entries: list[dict[str, Any]] = []
            used_names: set[str] = set()
            for parameter in parameters:
                original_name = str(parameter.get("name", ""))
                location = str(parameter.get("in", ""))
                required = bool(parameter.get("required")) or location == "path"
                base_name = to_camel_case(original_name)
                field_name = base_name
                index = 2
                while field_name in used_names:
                    field_name = f"{base_name}{index}"
                    index += 1
                used_names.add(field_name)
                parameter_entries.append(
                    {
                        "field_name": field_name,
                        "original_name": original_name,
                        "in": location,
                        "required": required,
                        "type": to_ts_type(parameter.get("schema")),
                    }
                )

            request_body = operation.get("requestBody")
            body_type: str | None = None
            body_required = False
            if isinstance(request_body, dict):
                body_schema = first_json_schema(request_body.get("content"))
                if body_schema:
                    body_type = to_ts_type(body_schema)
                    body_required = bool(request_body.get("required"))

            response_type = to_ts_type(success_response_schema(operation.get("responses")))
            operations.append(
                {
                    "operation_id": operation_id,
                    "method": method.upper(),
                    "path": path,
                    "params": parameter_entries,
                    "body_type": body_type,
                    "body_required": body_required,
                    "response_type": response_type,
                }
            )

    operations.sort(key=lambda item: (str(item["path"]), str(item["method"]), str(item["operation_id"])))

    for operation in operations:
        args_fields: list[str] = []
        for parameter in operation["params"]:
            optional = "" if parameter["required"] else "?"
            args_fields.append(f"  {parameter['field_name']}{optional}: {parameter['type']};")
        if operation["body_type"] is not None:
            optional = "" if operation["body_required"] else "?"
            args_fields.append(f"  body{optional}: {operation['body_type']};")
        if args_fields:
            args_name = f"{to_pascal_case(str(operation['operation_id']))}Args"
            lines.append(f"export interface {args_name} {{")
            lines.extend(args_fields)
            lines.append("}")
            lines.append("")
            operation["args_name"] = args_name
        else:
            operation["args_name"] = None

    lines.append("export class VarasaanApiClient {")
    lines.append("  public constructor(private readonly http: AxiosInstance) {}")
    lines.append("")
    lines.append("  private async request<TResponse>(config: AxiosRequestConfig): Promise<TResponse> {")
    lines.append("    const response = await this.http.request<TResponse>(config);")
    lines.append("    return response.data;")
    lines.append("  }")
    lines.append("")

    for operation in operations:
        args_name = operation["args_name"]
        if args_name:
            signature = f"args: {args_name}, config: AxiosRequestConfig = {{}}"
        else:
            signature = "config: AxiosRequestConfig = {}"
        lines.append(
            f"  public async {operation['operation_id']}({signature}): Promise<{operation['response_type']}> {{"
        )

        url_template = str(operation["path"])
        for parameter in operation["params"]:
            if parameter["in"] == "path":
                placeholder = "{" + parameter["original_name"] + "}"
                replacement = "${encodeURIComponent(String(args." + parameter["field_name"] + "))}"
                url_template = url_template.replace(placeholder, replacement)

        request_lines: list[str] = []
        request_lines.append("      ...config,")
        request_lines.append(f'      method: "{operation["method"]}",')
        request_lines.append(f"      url: `{url_template}`,")

        query_params = [p for p in operation["params"] if p["in"] == "query"]
        if query_params:
            parts = [f'"{param["original_name"]}": args.{param["field_name"]}' for param in query_params]
            request_lines.append(f"      params: {{ {', '.join(parts)} }},")

        header_params = [p for p in operation["params"] if p["in"] == "header"]
        if header_params:
            parts = [f'"{param["original_name"]}": args.{param["field_name"]}' for param in header_params]
            request_lines.append(f"      headers: {{ ...(config.headers ?? {{}}), {', '.join(parts)} }},")

        if operation["body_type"] is not None:
            request_lines.append("      data: args.body,")

        lines.append(f"    return this.request<{operation['response_type']}>({{")
        lines.extend(request_lines)
        lines.append("    });")
        lines.append("  }")
        lines.append("")

    lines.append("}")
    lines.append("")
    return "\n".join(lines)


def main() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    yaml_path = repo_root / "packages" / "shared" / "openapi" / "openapi.yaml"
    json_path = repo_root / "packages" / "shared" / "openapi" / "openapi.generated.json"

    spec: dict[str, Any]
    source_label: str

    if yaml_path.exists():
        if yaml is None:
            raise ModuleNotFoundError(
                "PyYAML is required to read packages/shared/openapi/openapi.yaml. "
                "Run this script with the backend uv environment (uv run --project backend ...) "
                "or install pyyaml in the active Python environment."
            )
        spec = yaml.safe_load(yaml_path.read_text(encoding="utf-8"))
        source_label = "packages/shared/openapi/openapi.yaml"
    elif json_path.exists():
        spec = json.loads(json_path.read_text(encoding="utf-8"))
        source_label = "packages/shared/openapi/openapi.generated.json"
    else:
        raise FileNotFoundError(
            "Neither OpenAPI YAML nor generated JSON artifact was available for API client generation."
        )

    json_output_path = repo_root / "packages" / "shared" / "openapi" / "openapi.generated.json"
    json_output_path.write_text(json.dumps(spec, indent=2) + "\n", encoding="utf-8")

    output_path = repo_root / "frontend" / "src" / "lib" / "generated" / "api-client.ts"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(render(spec, source_label), encoding="utf-8")

    print(f"Generated {json_output_path}")
    print(f"Generated {output_path}")


if __name__ == "__main__":
    main()

