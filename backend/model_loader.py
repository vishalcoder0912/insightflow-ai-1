try:
    from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
    import torch
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False

def generate_sql(question: str, schema: str) -> str:
    if not TRANSFORMERS_AVAILABLE:
        # Simple fallback SQL generation
        question_lower = question.lower()
        if "count" in question_lower:
            if "by" in question_lower:
                # Extract column after "by"
                parts = question_lower.split("by")
                if len(parts) > 1:
                    col = parts[1].strip().split()[0]
                    return f"SELECT {col}, COUNT(*) FROM dataset GROUP BY {col}"
            return "SELECT COUNT(*) FROM dataset"
        elif "average" in question_lower or "avg" in question_lower or "mean" in question_lower:
            if "by" in question_lower:
                # Extract column after "by" for average by category
                parts = question_lower.split("by")
                if len(parts) > 1:
                    col = parts[1].strip().split()[0]
                    # Try to find a numeric column for average
                    if "salary" in question_lower:
                        return f"SELECT {col}, AVG(salary) FROM dataset GROUP BY {col}"
                    elif "age" in question_lower:
                        return f"SELECT {col}, AVG(age) FROM dataset GROUP BY {col}"
                    else:
                        return f"SELECT {col}, AVG(*) FROM dataset GROUP BY {col}"  # Fallback
            return "SELECT AVG(*) FROM dataset"  # This will fail but it's a fallback
        elif "sum" in question_lower:
            return "SELECT SUM(*) FROM dataset"
        elif "max" in question_lower:
            return "SELECT MAX(*) FROM dataset"
        elif "min" in question_lower:
            return "SELECT MIN(*) FROM dataset"
        else:
            return "SELECT * FROM dataset LIMIT 100"
    
    # Original transformer code if available
    MODEL_NAME = "cssupport/t5-small-awesome-text-to-sql"
    
    print(f"[ModelLoader] Loading {MODEL_NAME}...")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_NAME)
    model.eval()
    print("[ModelLoader] Model ready.")
    
    prompt = f"translate English to SQL: {question} | {schema}"
    inputs = tokenizer(prompt, return_tensors="pt", max_length=512, truncation=True)
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=200,
            num_beams=4,
            early_stopping=True
        )
    sql = tokenizer.decode(outputs[0], skip_special_tokens=True)
    return sql.strip()
