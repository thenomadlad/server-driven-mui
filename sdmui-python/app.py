from dataclasses import asdict, dataclass
from flask import Flask, jsonify
from sdmui_python.decorators import NiceTable, sdui_magic


app = Flask(__name__)


@sdui_magic(layout=NiceTable)
@dataclass
class CalorieInformation:
    name: str
    calories: int
    fat: int
    carbs: int
    protein: int


ROWS = [
    CalorieInformation("Frozen yoghurt", 159, 6.0, 24, 4.0),
    CalorieInformation("Ice cream sandwich", 237, 9.0, 37, 4.3),
    CalorieInformation("Eclair", 262, 16.0, 24, 6.0),
    CalorieInformation("Cupcake", 305, 3.7, 67, 4.3),
    CalorieInformation("Gingerbread", 356, 16.0, 49, 3.9),
]


@app.route("/api/data", methods=["GET"])
def all_data():
    return jsonify(ROWS)


@app.route("/raw_structure_demo/_sdui", methods=["GET"])
def sdui_raw_data():
    return jsonify(
        [
            {
                "component": "TableContainer",
                "props": {"component": "Paper"},
                "children": [
                    {
                        "component": "Table",
                        "children": [
                            {
                                "component": "TableHead",
                                "children": [
                                    {
                                        "component": "TableRow",
                                        "children": [
                                            {
                                                "component": "TableCell",
                                                "children": "Dessert (100g serving)",
                                            },
                                            {
                                                "component": "TableCell",
                                                "children": "Calories",
                                            },
                                            {
                                                "component": "TableCell",
                                                "children": "Fat (g)",
                                            },
                                            {
                                                "component": "TableCell",
                                                "children": "Carbs (g)",
                                            },
                                            {
                                                "component": "TableCell",
                                                "children": "Protein (g)",
                                            },
                                        ],
                                    },
                                ],
                            },
                            {
                                "component": "TableBody",
                                "children": list(
                                    map(
                                        lambda row: {
                                            "component": "TableRow",
                                            "children": [
                                                {
                                                    "component": "TableCell",
                                                    "props": {
                                                        "component": "th",
                                                        "scope": "row",
                                                    },
                                                    "children": row.name,
                                                },
                                                {
                                                    "component": "TableCell",
                                                    "props": {"align": "right"},
                                                    "children": str(row.calories),
                                                },
                                                {
                                                    "component": "TableCell",
                                                    "props": {"align": "right"},
                                                    "children": str(row.calories),
                                                },
                                                {
                                                    "component": "TableCell",
                                                    "props": {"align": "right"},
                                                    "children": str(row.calories),
                                                },
                                                {
                                                    "component": "TableCell",
                                                    "props": {"align": "right"},
                                                    "children": str(row.calories),
                                                },
                                            ],
                                        },
                                        ROWS,
                                    )
                                ),
                            },
                        ],
                    },
                ],
            },
        ]
    )


@app.route("/nice_table_demo/_sdui", methods=["GET"])
def sdui_nicetable():
    return jsonify(
        [
            {
                "component": "NiceTable",
                "props": {
                    "headings": [
                        "Dessert (100g serving)",
                        "Calories",
                        "Fat (g)",
                        "Carbs (g)",
                        "Protein (g)",
                    ],
                    "rows": [asdict(row) for row in ROWS],
                },
            }
        ]
    )


@app.route("/decorator_demo/_sdui", methods=["GET"])
def sdui_generated():
    return jsonify(CalorieInformation.to_sdmui(ROWS))


if __name__ == "__main__":
    app.run()
