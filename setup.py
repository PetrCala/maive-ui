from setuptools import setup, find_packages

setup(
    name='artma',
    version='0.0.3-2',
    description='Automatic Replication Tools for Meta-Analysis',
    packages=find_packages(),
    install_requires=[
        'flask>=3.0.0',
    ],
    author='Petr Cala',
    author_email='cala.p@seznam.cz',
)
