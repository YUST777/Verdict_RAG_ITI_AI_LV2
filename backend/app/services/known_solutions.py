"""Small set of deterministic solutions for problems that can be solved exactly.

The hosted Railway model is deliberately tiny.  For a known problem, a direct
solver is safer and faster than asking the model to invent code.
"""

from __future__ import annotations

import re


def _normalise(value: str | None) -> str:
    return re.sub(r"\s+", " ", (value or "").lower()).strip()


def is_watermelon(problem_id: str | None, statement: str | None) -> bool:
    """Recognise Codeforces 4A without relying on retrieval results."""
    problem_key = _normalise(problem_id).replace("_", "-")
    text = _normalise(statement)
    return (
        problem_key in {"4-a", "4a", "4/a"}
        or "watermelon" in text
        and ("even" in text or "two parts" in text or "divide" in text)
    )


def watermelon_answer(language: str | None = None) -> str:
    language_key = _normalise(language)
    if language_key in {"python", "py"}:
        code = """w = int(input())
print(\"YES\" if w > 2 and w % 2 == 0 else \"NO\")"""
        fence = "python"
    else:
        code = """#include <iostream>
using namespace std;

int main() {
    int w;
    cin >> w;
    cout << (w > 2 && w % 2 == 0 ? \"YES\" : \"NO\");
    return 0;
}"""
        fence = "cpp"

    return f"""### Verified solution: Watermelon (Codeforces 4A)

**Key observation:** Two positive even parts can be made exactly when the weight is even and greater than `2`. The smallest valid split is `2 + 2`, so `2` itself is not valid.

**Algorithm:** Read `w`; print `YES` if `w > 2` and `w` is even, otherwise print `NO`.

**Proof:** If `w` is even and `w > 2`, then `w = 2 + (w - 2)`, and both parts are positive even numbers. If `w <= 2` or odd, no split into two positive even integers exists.

**Complexity:** `O(1)` time and `O(1)` memory.

```{fence}
{code}
```

This solution is deterministic for the exact problem and does not depend on the small language model."""


def known_answer(problem_id: str | None, statement: str | None, language: str | None) -> str | None:
    if is_watermelon(problem_id, statement):
        return watermelon_answer(language)
    return None

