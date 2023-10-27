from dataclasses import asdict, fields
from functools import partial
from flask import Flask


def nice_table_sdmui_data(cls, rows):
    return [
        {
            "component": "NiceTable",
            "props": {
                "headings": [field.name for field in fields(cls)],
                "rows": [asdict(row) for row in rows],
            },
        }
    ]


NiceTable = nice_table_sdmui_data


def sdui_magic(layout):
    def dataclass_wrapper(dataclass):
        dataclass.to_sdmui = partial(layout, dataclass)

        return dataclass

    return dataclass_wrapper
