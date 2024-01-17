from setuptools import setup, find_packages

setup(
    name='artma',
    version='0.0.5-2',
    description='Automatic Replication Tools for Meta-Analysis',
    packages=find_packages(),
    install_requires=[
        'flask>=3.0.0',
        'podman-compose>=1.0.6'
    ],
    extras_require={
        'docs': [
            'sphinx>=4.0.0',
            'sphinx-rtd-theme>=1.0.0',
        ],
    },
    author='Petr Cala',
    author_email='cala.p@seznam.cz',
)
