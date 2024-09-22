from llama_index.core.schema import ImageDocument
import asyncio
from llama_index.core import Document, SimpleDirectoryReader
from llama_index.core.node_parser import TokenTextSplitter
import os
import logging
from pathlib import Path
import hashlib

from .database import SQLiteDB
from .settings import CustomFormatter
from .settings import Model
import shutil

logger = logging.getLogger()
logger.setLevel(logging.INFO)
ch = logging.StreamHandler()
ch.setLevel(logging.INFO)
ch.setFormatter(CustomFormatter())
logger.addHandler(ch)
model = Model()
db = SQLiteDB()


async def summarize_document(doc: Document):
    logger.info(f"Processing file {doc.metadata['file_path']}")
    doc_hash = get_file_hash(doc.metadata['file_path'])
    if db.is_file_exist(doc.metadata['file_path'], doc_hash):
        summary = db.get_file_summary(doc.metadata['file_path'])
    else:
        summary = await model.summarize_document_api(doc.text)
        db.insert_file_summary(doc.metadata['file_path'], doc_hash, summary)
    return {
        "file_path": doc.metadata['file_path'],
        "summary": summary
    }


async def summarize_image_document(doc: ImageDocument):
    logger.info(f"Processing image {doc.image_path}")
    image_hash = get_file_hash(doc.image_path)
    if db.is_file_exist(doc.image_path, image_hash):
        summary = db.get_file_summary(doc.image_path)
    else:
        summary = await model.summarize_image_api(image_path=doc.image_path)
        db.insert_file_summary(doc.image_path, image_hash, summary)
    return {
        "file_path": doc.image_path,
        "summary": summary
    }


async def dispatch_summarize_document(doc):
    if isinstance(doc, ImageDocument):
        return await summarize_image_document(doc)
    elif isinstance(doc, Document):
        return await summarize_document(doc)
    else:
        raise ValueError("Document type not supported")


async def get_summaries(documents):
    docs_summaries = await asyncio.gather(
        *[dispatch_summarize_document(doc) for doc in documents]
    )
    return docs_summaries


async def remove_deleted_files():
    file_paths = db.get_all_files()
    deleted_file_paths = [file_path for file_path in file_paths if not os.path.exists(file_path)]
    db.delete_records(deleted_file_paths)


def load_documents(path: str, recursive: bool, required_exts: list):
    reader = SimpleDirectoryReader(
        input_dir=path,
        recursive=recursive,
        required_exts=required_exts,
        errors='ignore'
    )
    splitter = TokenTextSplitter(chunk_size=6144)
    documents = []
    for docs in reader.iter_data():
        # By default, llama index split files into multiple "documents"
        if len(docs) > 1:
            try:
                # So we first join all the document contexts, then truncate by token count
                text = splitter.split_text("\n".join([d.text for d in docs]))[0]
                documents.append(Document(text=text, metadata=docs[0].metadata))
            except Exception as e:
                logger.error(f"Error reading file {docs[0].metadata['file_path']} \n")  # , e.args)
        else:
            documents.append(docs[0])
    return documents


async def get_dir_summaries(path: str, recursive: bool, required_exts: list):
    doc_dicts = load_documents(path, recursive, required_exts)
    await remove_deleted_files()
    files_summaries = await get_summaries(doc_dicts)

    # Convert path to relative path
    for summary in files_summaries:
        summary["file_path"] = os.path.relpath(summary["file_path"], path)

    return files_summaries


async def run(directory_path: str, recursive: bool, required_exts: list):
    logger.info("Starting ...")

    summaries = await get_dir_summaries(directory_path, recursive, required_exts)
    files = await model.create_file_tree_api(summaries)

    # Recursively create dictionary from file paths
    tree = {}
    for file in files:
        parts = Path(file["dst_path"]).parts
        current = tree
        for part in parts:
            current = current.setdefault(part, {})

    return files


def update_file(root_path, item):
    src_file = root_path + "/" + item["src_path"]
    dst_file = root_path + "/" + item["dst_path"]
    dst_dir = os.path.dirname(dst_file)
    if not os.path.exists(dst_dir):
        os.makedirs(dst_dir)
    if os.path.isfile(src_file):
        shutil.move(src_file, dst_file)
        new_hash = get_file_hash(dst_file)
        db.update_file(src_file, dst_file, new_hash)


async def search_files(root_path: str, recursive: bool, required_exts: list, search_query: str):
    summaries = await get_dir_summaries(root_path, recursive, required_exts)
    files = await model.search_files_api(summaries, search_query)
    return files


def get_file_hash(file_path):
    hash_func = hashlib.new('sha256')
    with open(file_path, 'rb') as f:
        while chunk := f.read(8192):
            hash_func.update(chunk)
    return hash_func.hexdigest()
