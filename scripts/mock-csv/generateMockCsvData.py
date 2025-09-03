#!/usr/bin/env python3
"""
Script to process CSV files and generate TypeScript mock data.
Processes files in the data folder, extracting effect size, standard error, 
number of observations, and study ID columns.
Also saves processed CSV files with "_maive" appended to original names.
"""

import os
import csv
import re
import random
from pathlib import Path
from typing import List, Dict, Optional, Tuple

def identify_columns(headers: List[str]) -> Tuple[Optional[int], Optional[int], Optional[int], Optional[int]]:
    """
    Identify the column indices for effect, standard error, n observations, and study ID.
    
    Args:
        headers: List of column headers
        
    Returns:
        Tuple of (effect_col, se_col, n_col, study_col) indices
    """
    effect_col = None
    se_col = None
    n_col = None
    study_col = None
    
    for i, header in enumerate(headers):
        header_lower = header.lower().strip()
        
        # Effect size column (usually first, or contains effect-related terms)
        if effect_col is None:
            if (i == 0 or 
                any(term in header_lower for term in ['d', 'es', 'effect', 'coef', 'beta', 'estimate'])):
                effect_col = i
        
        # Standard error column
        if se_col is None:
            if any(term in header_lower for term in ['se', 'sed', 'stderr', 'standard_error', 'std_error']):
                se_col = i
        
        # Number of observations column
        if n_col is None:
            if any(term in header_lower for term in ['n', 'nobs', 'sample_size', 'observations']):
                n_col = i
        
        # Study ID column
        if study_col is None:
            if any(term in header_lower for term in ['study', 'study_id', 'id', 'group', 'cluster', 'study id', 'study_id', 'studyid']):
                study_col = i
    
    # If we couldn't find effect column, assume it's the first numeric column
    if effect_col is None:
        effect_col = 0
    
    # If we couldn't find SE column, assume it's the second column
    if se_col is None:
        se_col = 1
    
    # If we couldn't find n column, assume it's the third column
    if n_col is None:
        n_col = 2
    
    # Study column is optional
    return effect_col, se_col, n_col, study_col

def process_csv_file(file_path: Path, file_index: int) -> Optional[Dict]:
    """
    Process a single CSV file and extract the required data.
    
    Args:
        file_path: Path to the CSV file
        file_index: Index of the file for generating non-descriptive names
        
    Returns:
        Dictionary with name, content, filename, original_filename, and processed_data, or None if processing fails
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            # Try to detect delimiter
            sample = f.read(1024)
            f.seek(0)
            
            # Common delimiters to try
            delimiters = [',', '\t', ';', '|']
            detected_delimiter = ','
            
            for delimiter in delimiters:
                if delimiter in sample:
                    detected_delimiter = delimiter
                    break
            
            reader = csv.reader(f, delimiter=detected_delimiter)
            rows = list(reader)
            
            if len(rows) < 2:  # Need at least header + 1 data row
                return None
            
            headers = rows[0]
            data_rows = rows[1:]
            
            # Identify columns
            effect_col, se_col, n_col, study_col = identify_columns(headers)
            
            if effect_col is None or se_col is None or n_col is None:
                print(f"Warning: Could not identify required columns in {file_path}")
                return None
            
            # Process data rows and assign probabilistic study IDs
            processed_rows = []
            study_id = 1
            # Probability of incrementing study ID (adjust this value to control grouping)
            increment_probability = 0.3  # 30% chance to increment to next study
            
            for row in data_rows:
                if len(row) < max(effect_col, se_col, n_col) + 1:
                    continue  # Skip incomplete rows
                
                try:
                    effect = float(row[effect_col])
                    se = float(row[se_col])
                    n = int(float(row[n_col]))

                    if study_col is not None:
                        current_study_id = row[study_col]
                    else:
                        current_study_id = study_id
                    
                        # Probabilistically increment study ID for next iteration
                        if random.random() < increment_probability:
                            study_id += 1
                        
                    # Format row: effect,se,n,study_id
                    processed_rows.append(f"{effect},{se},{n},{current_study_id}")
                    
                except (ValueError, TypeError):
                    continue  # Skip rows with invalid data
            
            if not processed_rows:
                return None
            
            # Generate non-descriptive name and filename
            name = f"Mock Data {file_index}"
            filename = f"mock_data_{file_index}.csv"
            
            # Create content string
            content = '\n'.join(processed_rows)
            
            return {
                'name': name,
                'content': content,
                'filename': filename,
                'original_filename': file_path.name,
                'processed_data': processed_rows
            }
            
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return None

def generate_typescript_output(mock_data: List[Dict]) -> str:
    """
    Generate the TypeScript output string.
    
    Args:
        mock_data: List of processed CSV data dictionaries
        
    Returns:
        TypeScript code as string
    """
    ts_code = """// Mock CSV files for testing and development
// Each file contains realistic data with effect size, standard error, sample size, and study ID

export const mockCsvFiles = [
"""
    
    for i, data in enumerate(mock_data):
        ts_code += f"""  {{
    name: "{data['name']}",
    content: `{data['content']}`,
    filename: "{data['filename']}",
    original_filename: "{data['original_filename']}",
  }}"""
        
        if i < len(mock_data) - 1:
            ts_code += ","
        ts_code += "\n"
    
    ts_code += """];

export const getRandomMockCsvFile = () => {
  const randomIndex = Math.floor(Math.random() * mockCsvFiles.length);
  return mockCsvFiles[randomIndex];
};
"""
    
    return ts_code

def save_processed_csv_files(mock_data: List[Dict], output_folder: Path) -> None:
    """
    Save processed CSV files with "_maive" appended to original names.
    
    Args:
        mock_data: List of processed CSV data dictionaries
        output_folder: Path to the output folder
    """
    # Create output folder if it doesn't exist
    output_folder.mkdir(exist_ok=True)
    
    print(f"\nSaving processed CSV files to: {output_folder}")
    
    for data in mock_data:
        if 'original_filename' in data and 'processed_data' in data:
            # Get original filename without extension
            original_name = Path(data['original_filename']).stem
            # Create new filename with "_maive" appended
            new_filename = f"{original_name}_maive.csv"
            output_path = output_folder / new_filename
            
            # Write processed data to CSV
            with open(output_path, 'w', encoding='utf-8', newline='') as f:
                writer = csv.writer(f)
                # Write header
                writer.writerow(['effect', 'se', 'n', 'study_id'])
                # Write data rows
                for row in data['processed_data']:
                    writer.writerow(row.split(','))
            
            print(f"  Saved: {new_filename}")

def main():
    """Main function to process CSV files and generate TypeScript output."""
    # Use the data folder in the same directory as this script
    data_path = Path(__file__).parent / "data"
    
    if not data_path.exists() or not data_path.is_dir():
        print(f"Error: Could not find data folder at {data_path}")
        return
    
    print(f"Found data folder: {data_path}")
    
    # Find all CSV files, excluding those with "(with fitted variances)" in the name
    csv_files = []
    for file_path in data_path.glob("*.csv"):
        if "(with fitted variances)" not in file_path.name:
            csv_files.append(file_path)
    
    if not csv_files:
        print("No CSV files found in data folder.")
        return
    
    print(f"Found {len(csv_files)} CSV files to process:")
    for file_path in csv_files:
        print(f"  - {file_path.name}")
    
    # Process each CSV file
    mock_data = []
    for file_index, file_path in enumerate(csv_files, 1):
        print(f"Processing {file_path.name}...")
        result = process_csv_file(file_path, file_index)
        if result:
            mock_data.append(result)
            row_count = len(result['content'].split('\n'))
            print(f"  Successfully processed {row_count} rows")
        else:
            print(f"  Failed to process")
    
    if not mock_data:
        print("No files were successfully processed.")
        return
    
    # Save processed CSV files
    maive_output_folder = Path(__file__).parent / "maive_processed"
    save_processed_csv_files(mock_data, maive_output_folder)
    
    # Generate TypeScript output
    ts_output = generate_typescript_output(mock_data)
    
    # Write to mockCsvFiles.ts in the react-ui client utils directory
    output_file = Path("../../apps/react-ui/client/src/utils/mockCsvFiles.ts")
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(ts_output)
    
    print(f"\nSuccessfully processed {len(mock_data)} files.")
    print(f"TypeScript output written to: {output_file.absolute()}")
    total_rows = sum(len(data['content'].split('\n')) for data in mock_data)
    print(f"Total rows processed: {total_rows}")

if __name__ == "__main__":
    main()
