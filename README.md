# Document Translation

A document translation application that allows users to upload a document, provide translation context, review the translated result, edit it, and download the final document.

The initial goal is to support documents up to **5 MB**.

## User Flow

1. User uploads a document.
2. User provides translation context:
   - Document purpose
   - Emotion tags
   - Voice/tone tags

3. The system translates the document.
4. User previews the translated document.
5. User can edit the translated content using an online text editor.
6. User downloads the translated document.

## Initial Supported Documents

The first version will focus on business documents such as:

- Quotation
- Invoice

Additional document types can be added later.

## Scope

### In Scope

- Document upload
- Document text extraction
- Translation
- Translation context
- Translation preview
- Online editing
- Document download
- Documents up to 5 MB

### Out of Scope

- User accounts
- Authentication
- Storing user credentials
- Storing personal user information
- Long-term document storage
- User document history

## Goal

The main goal of this project is to learn how to build a document-processing application that combines:

- Document parsing
- Text processing
- Machine translation
- Backend services
- Frontend editing
- Document generation
- Asynchronous processing
- Cost-efficient infrastructure

The application should prioritize **low infrastructure cost** while maintaining reasonable translation quality and processing speed.
