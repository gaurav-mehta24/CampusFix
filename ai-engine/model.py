
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

print("Loading CampusFix AI model...")

model = SentenceTransformer("all-MiniLM-L6-v2")

complaints = [
    "Water supply is not working in hostel.",
    "There is no water in my hostel washroom.",
    "The college WiFi is very slow."
]

embeddings = model.encode(complaints)
similarity = cosine_similarity(embeddings)

print("\nCampusFix AI Similarity Results:\n")

for i in range(len(complaints)):
    for j in range(i + 1, len(complaints)):
        print(
            f"Complaint {i+1} vs Complaint {j+1}: "
            f"{similarity[i][j]:.2%}"
        )
