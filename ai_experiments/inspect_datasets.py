import kagglehub
import pandas as pd
import os

def inspect_jobs():
    print("Inspecting jobs dataset...")
    try:
        # Download latest version
        path = kagglehub.dataset_download("kshitizregmi/jobs-and-job-description")
        print("Path to dataset files:", path)
        
        # Let's list files in the downloaded path
        files = os.listdir(path)
        print("Files:", files)
        
        csv_file = [f for f in files if f.endswith('.csv')][0]
        df = pd.read_csv(os.path.join(path, csv_file))
        print("Jobs columns:", df.columns.tolist())
        print("Jobs sample:", df.head(1).to_dict('records'))
    except Exception as e:
        print("Jobs dataset error:", e)

if __name__ == "__main__":
    inspect_jobs()
