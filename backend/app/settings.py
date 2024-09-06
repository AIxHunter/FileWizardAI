import time

from pydantic_settings import BaseSettings, SettingsConfigDict
from openai import AsyncOpenAI
import base64
import logging
import json
import sys
import requests
import logging

logger = logging.getLogger()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env')
    TEXT_API_END_POINT: str
    TEXT_MODEL_NAME: str
    TEXT_API_KEYS: list[str]
    IMAGE_API_END_POINT: str
    IMAGE_MODEL_NAME: str
    IMAGE_API_KEYS: list[str]


class Model:
    settings = Settings()

    TEXT_API_END_POINT = settings.TEXT_API_END_POINT
    TEXT_MODEL_NAME = settings.TEXT_MODEL_NAME
    TEXT_API_KEYS = settings.TEXT_API_KEYS
    IMAGE_API_END_POINT = settings.IMAGE_API_END_POINT
    IMAGE_MODEL_NAME = settings.IMAGE_MODEL_NAME
    IMAGE_API_KEYS = settings.IMAGE_API_KEYS
    text_keys_count = len(TEXT_API_KEYS)
    image_keys_count = len(IMAGE_API_KEYS)
    MAX_TOKEN_SIZE = 4000 # Increase or decrease based on the model context window size
    cnt_txt = 0
    cnt_img = 0

    def __init__(self):
        self.async_text_clients = [AsyncOpenAI(base_url=self.TEXT_API_END_POINT, api_key=api_key)
                                   for api_key in self.TEXT_API_KEYS]
        self.async_image_clients = [AsyncOpenAI(base_url=self.IMAGE_API_END_POINT, api_key=api_key)
                                    for api_key in self.IMAGE_API_KEYS]

    async def summarize_image_api(self, image_path):
        prompt = """
        Describe this image in the most concise way possible, capturing only the essential elements and details. 
        Aim for a very brief yet accurate summary.
        """
        attempt = 0
        summary = ""
        # Huggingface API doesn't support image completions
        if "huggingface.co" in self.IMAGE_API_END_POINT.lower():
            # To avoid rate_limit_exceeded or api error
            endpoint_url = self.IMAGE_API_END_POINT.replace("v1", "models") + "/" + self.IMAGE_MODEL_NAME
            while attempt < 5:
                try:
                    headers = {"Authorization": f"Bearer {self.IMAGE_API_KEYS[self.cnt_img % self.image_keys_count]}"}
                    with open(image_path, "rb") as f:
                        data = f.read()
                        response = requests.post(endpoint_url, headers=headers, data=data)
                    summary = response.json()[0]["generated_text"]
                    break
                except Exception as e:
                    logger.error("Error {}".format(e))
                    attempt += 1
                    self.cnt_img += 1
        else:
            with open(image_path, "rb") as image_file:
                base64_image = base64.b64encode(image_file.read()).decode('utf-8')
            # To avoid rate_limit_exceeded or api error
            while attempt < 5:
                try:
                    chat_completion = await self.async_image_clients[
                        self.cnt_img % self.text_keys_count].chat.completions.create(
                        model=Model.IMAGE_MODEL_NAME,
                        messages=[
                            {
                                "role": "user",
                                "content": [
                                    {"type": "text", "text": prompt},
                                    {
                                        "type": "image_url",
                                        "image_url": {
                                            "url": f"data:image/jpeg;base64,{base64_image}"
                                        },
                                    },
                                ],
                            }
                        ],
                        timeout=None,
                        temperature=0,
                    )
                    summary = chat_completion.choices[0].message.content
                    break
                except Exception as e:
                    logger.error("Error {}".format(e))
                    attempt += 1
                    self.cnt_img += 1
        return summary

    async def summarize_document_api(self, doc_text):
        prompt = """
        You will be provided with the contents of a file. Provide a summary of the contents. 
        The purpose of the summary is to organize files based on their content. 
        To this end provide a concise but informative summary. Make the summary as specific to the file as possible.
        It is very important that you only provide the final output without any additional comments or remarks.
        """.strip()
        attempt = 0
        summary = ""
        # To avoid rate_limit_exceeded or api error
        while attempt < 5:
            try:
                chat_completion = await self.async_text_clients[
                    self.cnt_txt % self.text_keys_count].chat.completions.create(
                    model=Model.TEXT_MODEL_NAME,
                    messages=[
                        {"role": "system", "content": prompt},
                        {"role": "user", "content": doc_text},
                    ],
                    stream=False,
                    temperature=0,
                    timeout=None,
                )
                summary = chat_completion.choices[0].message.content
                break
            except Exception as e:
                logger.error("Error {}".format(e))
                attempt += 1
                self.cnt_txt += 1
        return summary

    async def create_file_tree_api(self, summaries: list):
        tmp: list = []
        file_tree: list = []
        for summary in summaries:
            # it's better to use tiktoken here
            if (sys.getsizeof(json.dumps(tmp)) + sys.getsizeof(json.dumps(summary))) / 4 >= self.MAX_TOKEN_SIZE:
                file_tree = file_tree + await self.create_file_tree_api_chunk(tmp)
                tmp = []
            else:
                tmp.append(summary)
        if len(tmp) > 0:
            file_tree = file_tree + await self.create_file_tree_api_chunk(tmp)
        return file_tree

    async def create_file_tree_api_chunk(self, summaries: list):
        file_prompt = """
        You will be provided with list of source files and a summary of their contents.
        For each file,propose a new path and filename, using a directory structure that optimally organizes the files using known conventions and best practices.
        Follow good naming conventions. Here are a few guidelines
        - Think about your files : What related files are you working with?
        - Identify metadata (for example, date, sample, experiment) : What information is needed to easily locate a specific file?
        - Abbreviate or encode metadata
        - Use versioning : Are you maintaining different versions of the same file?
        - Think about how you will search for your files : What comes first?
        - Deliberately separate metadata elements : Avoid spaces or special characters in your file names
        If the file is already named well or matches a known convention, set the destination path to the same as the source path.

        Your response must be a JSON object with the following schema, dont add any extra text except the json:
        ```json
        {
            "files": [
                {
                    "src_path": "original file path",
                    "dst_path": "new file path under proposed directory structure with proposed file name"
                }
            ]
        }
        ```
        """.strip()
        attempt = 0
        file_tree = None
        while attempt < 10:
            try:
                chat_completion = await self.async_text_clients[
                    self.cnt_txt % self.text_keys_count].chat.completions.create(
                    messages=[
                        {"role": "system", "content": file_prompt},
                        {"role": "user", "content": json.dumps(summaries)},
                    ],
                    model=self.TEXT_MODEL_NAME,
                    stream=False,
                    temperature=0,
                )
                result = chat_completion.choices[0].message.content
                # case when llm doesn't support llama json template
                result = result.replace("```json", "").replace("```", "").strip()
                file_tree = json.loads(result)["files"]
                break
            except Exception as e:
                logger.error("Error {}".format(e))
                attempt += 1
                self.cnt_txt += 1
                time.sleep(2)
        return file_tree

    async def search_files_api(self, summaries: list, search_query: str):
        tmp: list = []
        files: list = []
        for summary in summaries:
            # it's better to use tiktoken here
            if (sys.getsizeof(json.dumps(tmp)) + sys.getsizeof(json.dumps(summary))) / 4 >= self.MAX_TOKEN_SIZE:
                files = files + await self.search_files_api_chunk(tmp, search_query)
                tmp = []
            else:
                tmp.append(summary)
        if len(tmp) > 0:
            files = files + await self.search_files_api_chunk(tmp, search_query)
        return files

    async def search_files_api_chunk(self, summaries: list, search_query: str):
        file_prompt = """
        You will be provided with list of source files and a summary of their contents:
        return the files that matches or have a similar content to this search query: """ + search_query + """

        Your response must be a JSON object with the following schema, dont add any extra text except the json:
        ```json
        {
        "files": [
                {
                    "file": "File that matches or have a similar content to the search query"
                }
            ]
        }
        """.strip()
        while True:
            try:
                chat_completion = await self.async_text_clients[
                    self.cnt_txt % self.text_keys_count].chat.completions.create(
                    messages=[
                        {"role": "system", "content": file_prompt},
                        {"role": "user", "content": json.dumps(summaries)},
                    ],
                    model=self.TEXT_MODEL_NAME,
                    stream=False,
                    timeout=None,
                )
                result = chat_completion.choices[0].message.content
                files = json.loads(result)["files"]
                break
            except Exception as e:
                logger.error("Error {}".format(e))
                self.cnt_txt += 1
                time.sleep(2)
        return files


class CustomFormatter(logging.Formatter):
    grey = "\x1b[38;5;15m"
    yellow = "\x1b[33;20m"
    red = "\x1b[31;20m"
    bold_red = "\x1b[31;1m"
    reset = "\x1b[0m"
    format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s (%(filename)s:%(lineno)d)"

    FORMATS = {
        logging.DEBUG: grey + format + reset,
        logging.INFO: grey + format + reset,
        logging.WARNING: yellow + format + reset,
        logging.ERROR: red + format + reset,
        logging.CRITICAL: bold_red + format + reset
    }

    def format(self, record):
        log_fmt = self.FORMATS.get(record.levelno)
        formatter = logging.Formatter(log_fmt)
        return formatter.format(record)
