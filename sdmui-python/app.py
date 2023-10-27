from dataclasses import dataclass
from flask import Flask, jsonify

app = Flask(__name__)


@dataclass
class DataPiece:
    name: str
    calories: int
    fat: int
    carbs: int
    protein: int


def create_data(name: str, calories: int, fat: int, carbs: int, protein: int):
    return DataPiece(name, calories, fat, carbs, protein)


ROWS = [
    create_data("Frozen yoghurt", 159, 6.0, 24, 4.0),
    create_data("Ice cream sandwich", 237, 9.0, 37, 4.3),
    create_data("Eclair", 262, 16.0, 24, 6.0),
    create_data("Cupcake", 305, 3.7, 67, 4.3),
    create_data("Gingerbread", 356, 16.0, 49, 3.9),
]


@app.route("/data/_sdui", methods=["GET"])
def show_sdui_data():
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


if __name__ == "__main__":
    app.run()
