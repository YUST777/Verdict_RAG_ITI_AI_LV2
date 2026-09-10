#!/usr/bin/env python3
"""Executable benchmark for a llama.cpp OpenAI-compatible coding model.

The benchmark deliberately scores compiled programs on edge cases.  A model
answer is counted as correct only when its extracted C++17 code compiles and
produces the expected output for every fixture in that problem.

Examples:
  python local-ai/benchmark_model.py --url http://127.0.0.1:8082
  python local-ai/benchmark_model.py --url http://model:8080 --json report.json
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import tempfile
import time
from pathlib import Path
from urllib.request import Request, urlopen


PROBLEMS = [
    {
        "name": "watermelon",
        "prompt": """Write a complete C++17 solution for this exact problem. Return one markdown cpp code block and no other code. Do not print prompts. A watermelon weighs w (1 <= w <= 100). Determine whether it can be split into TWO POSITIVE integer parts where EACH part has EVEN weight. Output YES if possible and NO otherwise. Check w=1, 2, 3, 4, 6 before finalizing.""",
        "fixtures": [("1\n", "NO"), ("2\n", "NO"), ("3\n", "NO"), ("4\n", "YES"), ("6\n", "YES"), ("100\n", "YES")],
    },
    {
        "name": "a_plus_b",
        "prompt": """Write a complete C++17 solution for this exact problem. Return one markdown cpp code block and no other code. Do not print prompts. Read two integers a and b (0 <= a,b <= 10^9) and print a+b.""",
        "fixtures": [("1 2\n", "3"), ("1000000000 1000000000\n", "2000000000"), ("0 0\n", "0")],
    },
    {
        "name": "valid_parentheses",
        "prompt": """Write a complete C++17 solution for this exact problem. Return one markdown cpp code block and no other code. Do not print prompts. Read a non-empty string containing only (), [], and {}. Print YES exactly when brackets are properly balanced and nested; otherwise print NO.""",
        "fixtures": [("([]{})\n", "YES"), ("([)]\n", "NO"), ("((\n", "NO"), ("{}[]()\n", "YES")],
    },
    {
        "name": "binary_search",
        "prompt": """Write a complete C++17 solution for this exact problem. Return one markdown cpp code block and no other code. Do not print prompts. Input has three lines: n (1 <= n <= 100000), then n distinct integers in strictly increasing order, then x. Print the zero-based index of x, or -1 when x is absent. Use binary search.""",
        "fixtures": [("5\n1 3 5 7 9\n7\n", "3"), ("5\n1 3 5 7 9\n6\n", "-1"), ("1\n42\n42\n", "0")],
    },
    {
        "name": "factorial",
        "prompt": """Write a complete C++17 solution for this exact problem. Return one markdown cpp code block and no other code. Do not print prompts. Read n (0 <= n <= 20) and print n! as an exact integer.""",
        "fixtures": [("0\n", "1"), ("5\n", "120"), ("20\n", "2432902008176640000")],
    },
]


def call_model(url: str, model: str, prompt: str, timeout: float, max_tokens: int) -> tuple[str, dict]:
    body = json.dumps(
        {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.1,
            "max_tokens": max_tokens,
            "stream": False,
        }
    ).encode()
    request = Request(
        url.rstrip("/") + "/v1/chat/completions",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    started = time.perf_counter()
    with urlopen(request, timeout=timeout) as response:
        payload = json.loads(response.read())
    elapsed_ms = round((time.perf_counter() - started) * 1000)
    answer = payload.get("choices", [{}])[0].get("message", {}).get("content", "")
    usage = payload.get("usage", {})
    return answer, {"latency_ms": elapsed_ms, "usage": usage}


def extract_cpp(answer: str) -> str:
    blocks = re.findall(r"```(?:cpp|c\+\+|C\+\+)?\s*\n?(.*?)```", answer, flags=re.IGNORECASE | re.DOTALL)
    if blocks:
        return max(blocks, key=len).strip()
    # A code-only answer may omit fences.  Keep this fallback diagnostic; it
    # is still judged by the compiler and therefore cannot receive credit for
    # prose that merely resembles a solution.
    start = min((i for i in (answer.find("#include"), answer.find("int main")) if i >= 0), default=-1)
    return answer[start:].strip() if start >= 0 else ""


def compile_and_run(source: str, fixtures: list[tuple[str, str]], timeout: float) -> dict:
    if not source:
        return {"compiled": False, "compiler_available": True, "compile_stderr": "No C++ code block was returned.", "cases": []}
    with tempfile.TemporaryDirectory(prefix="verdict-bench-") as directory:
        root = Path(directory)
        source_path = root / "solution.cpp"
        binary_path = root / "solution"
        source_path.write_text(source)
        try:
            compile_result = subprocess.run(
                ["g++", "-std=c++17", "-O2", "-pipe", str(source_path), "-o", str(binary_path)],
                capture_output=True,
                text=True,
                timeout=timeout,
            )
        except FileNotFoundError:
            return {
                "compiled": False,
                "compiler_available": False,
                "compile_stderr": "g++ was not found. Run this benchmark on a host/container with a C++17 compiler.",
                "cases": [],
            }
        result = {
            "compiled": compile_result.returncode == 0,
            "compiler_available": True,
            "compile_stderr": compile_result.stderr[-2000:],
            "cases": [],
        }
        if compile_result.returncode != 0:
            return result
        for stdin, expected in fixtures:
            try:
                run = subprocess.run(
                    [str(binary_path)],
                    input=stdin,
                    capture_output=True,
                    text=True,
                    timeout=timeout,
                )
                actual = run.stdout.strip()
                result["cases"].append(
                    {"input": stdin, "expected": expected, "actual": actual, "passed": run.returncode == 0 and actual == expected}
                )
            except subprocess.TimeoutExpired:
                result["cases"].append({"input": stdin, "expected": expected, "actual": "<timeout>", "passed": False})
        result["passed"] = all(case["passed"] for case in result["cases"])
        return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8082", help="llama.cpp server base URL")
    parser.add_argument("--model", default="qwen2.5-coder:3b-q3-cuda")
    parser.add_argument("--timeout", type=float, default=180.0)
    parser.add_argument("--max-tokens", type=int, default=512)
    parser.add_argument("--json", type=Path, help="also write the complete report to this file")
    args = parser.parse_args()

    report = {"url": args.url, "model": args.model, "problems": []}
    for problem in PROBLEMS:
        entry = {"name": problem["name"]}
        try:
            answer, meta = call_model(args.url, args.model, problem["prompt"], args.timeout, args.max_tokens)
            entry.update(meta)
            entry["answer"] = answer
            entry["code"] = extract_cpp(answer)
            entry["judge"] = compile_and_run(entry["code"], problem["fixtures"], args.timeout)
        except Exception as error:  # Keep the remaining benchmark cases running.
            entry["error"] = f"{type(error).__name__}: {error}"
        report["problems"].append(entry)
        judge = entry.get("judge", {})
        status = "PASS" if judge.get("passed") else "FAIL"
        print(f"{status:4} {problem['name']:<20} latency={entry.get('latency_ms', '-')}ms")
        if not judge.get("compiled", True):
            print("      compile error:", judge.get("compile_stderr", "").splitlines()[-1:])
        elif judge:
            failed = [case for case in judge.get("cases", []) if not case.get("passed")]
            if failed:
                print("      first failure:", failed[0])
        if entry.get("error"):
            print("      request error:", entry["error"])
    passed = sum(bool(item.get("judge", {}).get("passed")) for item in report["problems"])
    report["summary"] = {"passed": passed, "total": len(PROBLEMS)}
    print(f"\nScore: {passed}/{len(PROBLEMS)} problems passed all compile/runtime fixtures")
    if args.json:
        args.json.write_text(json.dumps(report, indent=2))
        print(f"Report: {args.json}")
    return 0 if passed == len(PROBLEMS) else 1


if __name__ == "__main__":
    raise SystemExit(main())
