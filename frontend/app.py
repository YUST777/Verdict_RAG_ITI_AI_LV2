import os
import streamlit as st
from api_client import RAGClient

st.set_page_config(
    page_title="Verdict RAG — ITI AI LV2",
    page_icon="⚖️",
    layout="wide",
    initial_sidebar_state="expanded",
)

client = RAGClient()

# Header
st.title("⚖️ Verdict RAG — Competitive Programming AI Tutor")
st.caption("Grounded Retrieval-Augmented Generation assistant for algorithms and problem solving (ITI AI LV2 Graduation Project)")

# Sidebar configuration
with st.sidebar:
    st.header("⚙️ System Status")
    health = client.check_health()
    if health.get("status") == "ok":
        st.success("Backend: Online ✅")
        st.metric("Indexed Chunks", health.get("document_count", 0))
        st.caption(f"Chroma Ready: {health.get('chroma_ready')} | LLM Configured: {health.get('ollama_configured')}")
    else:
        st.error(f"Backend: Offline ❌ ({health.get('error', 'check connection')})")
        st.info("Tip: Ensure the FastAPI service is running on the configured port.")

    st.divider()
    st.header("🎯 Mode Selection")
    mode = st.selectbox(
        "Tutor Mode",
        options=["teach", "hint", "full", "debug", "explain"],
        index=0,
        help="Teach explains concepts, Hint gives directional clues, Full outputs a complete compilable solution."
    )
    language = st.selectbox("Language", options=["cpp", "python", "java"], index=0)

    st.divider()
    st.header("📚 Quick Test Problems")
    preset = st.radio(
        "Load Problem Template:",
        options=[
            "None (Custom)",
            "A. Say Hello With C++",
            "Watermelon (4A)",
            "Binary Search on Answer"
        ]
    )

default_statement = ""
default_question = "Explain how to solve this problem and give the algorithm steps."

if preset == "A. Say Hello With C++":
    default_statement = """A. Say Hello With C++
time limit per test: 1 second
memory limit per test: 256 megabytes

Given a name S. Print "Hello, (name)" without parentheses.

Input
Only one line containing a string S.

Output
Print "Hello, " without quotes, then print name.

Example
Input:
programmer
Output:
Hello, programmer"""
    default_question = "Solve this problem in C++ and explain how standard input/output works."

elif preset == "Watermelon (4A)":
    default_statement = """Watermelon (Codeforces 4A)
One hot summer day Pete and his friend Billy decided to buy a watermelon. They chose the biggest and the ripest one, in their opinion. After that the watermelon was weighed, and the scales showed w kilos.

They rushed home, dying of thirst, and decided to divide the berry, however they faced a hard problem.
Pete and Billy are great fans of even numbers, that's why they want to divide the watermelon in such a way that each of the two parts weighs even number of kilos, at the same time it is not obligatory that the parts are equal.

Output YES, if the boys can divide the watermelon into two parts, each of them weighing even number of kilos; and NO in the opposite case."""
    default_question = "Give me a hint on the mathematical parity observation and edge case."

elif preset == "Binary Search on Answer":
    default_statement = """Given an array of machine production speeds and a target k items, find the minimum time needed to produce k items."""
    default_question = "How do I determine if binary search on answer is applicable?"

# Main Layout
col_left, col_right = st.columns([1.1, 1.3])

with col_left:
    st.subheader("📝 Problem Context")
    problem_text = st.text_area("Problem Statement", value=default_statement, height=220, placeholder="Paste problem statement or description here...")
    user_code = st.text_area("Your Current Code (Optional)", height=140, placeholder="// Paste your partial code here if debugging...")

with col_right:
    st.subheader("💬 Ask the Coach")
    question_input = st.text_area("Your Question / Prompt", value=default_question, height=100)
    ask_button = st.button("🚀 Ask Verdict RAG", type="primary", use_container_width=True)

if ask_button:
    if not question_input.strip():
        st.warning("Please enter a question or request.")
    else:
        with st.spinner("🔍 Retrieving grounded knowledge and generating response..."):
            try:
                res = client.query(
                    question=question_input.strip(),
                    mode=mode,
                    problem_statement=problem_text.strip() or None,
                    code=user_code.strip() or None,
                    language=language,
                    top_k=5,
                )

                answer = res.get("answer", "")
                citations = res.get("citations", [])
                latency = res.get("latency_ms", 0)
                grounded = res.get("grounded", False)
                model_name = res.get("model", "unknown")

                st.success(f"Response received in {latency/1000:.2f}s using `{model_name}` (Grounded: {'✅ Yes' if grounded else 'ℹ️ General'})")

                st.markdown("### 💡 Answer")
                st.markdown(answer)

                if citations:
                    st.divider()
                    st.markdown("### 📖 Retrieved Sources & Citations")
                    for i, cit in enumerate(citations, 1):
                        title = cit.get("title", f"Source {i}")
                        source_url = cit.get("source", "")
                        score = cit.get("score")
                        score_text = f" (Similarity: {score:.2f})" if score is not None else ""
                        with st.expander(f"[{i}] {title}{score_text}"):
                            st.write(f"**URL / Path:** {source_url}")
                            if cit.get("metadata", {}).get("chunk") is not None:
                                st.caption(f"Chunk #{cit['metadata']['chunk']}")

            except Exception as e:
                st.error(f"Error querying RAG backend: {e}")
