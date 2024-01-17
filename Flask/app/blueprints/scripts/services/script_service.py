import subprocess

def run_r_script():
    try:
        result = subprocess.run(['Rscript', './test_script.R'], check=True, stdout=subprocess.PIPE) # TODO modify
        return result.stdout.decode('utf-8')
    except subprocess.CalledProcessError as e:
        return str(e)
