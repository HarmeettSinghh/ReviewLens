import { useState, useRef } from 'react';
import { uploadCsv } from '../api';

export default function UploadBox({ onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    setError(null);
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!loading) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (loading) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.toLowerCase().endsWith('.csv')) {
        setError(null);
        setFile(droppedFile);
      } else {
        setError('Only .csv files are supported.');
      }
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please choose a .csv file first.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const summary = await uploadCsv(file);
      // Reset file input on successful upload
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (onUploadSuccess) {
        onUploadSuccess(summary);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`upload-box-card ${isDragging ? 'is-dragging' : ''}`}>
      <div className="upload-box-header">
        <div>
          <h2 className="section-title">Upload Dataset</h2>
          <span className="file-hint">CSV reviews dataset (up to 2 MB)</span>
        </div>
        {file && (
          <span className="file-ready-badge">Ready: {(file.size / 1024).toFixed(1)} KB</span>
        )}
      </div>

      <form onSubmit={handleUpload} className="upload-form">
        <div
          className={`file-input-wrapper ${isDragging ? 'is-drag-target' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            disabled={loading}
            className="file-input"
            id="csv-upload-input"
          />
          <label htmlFor="csv-upload-input" className="file-input-label">
            {file ? (
              <span className="file-name-selected">📄 {file.name}</span>
            ) : isDragging ? (
              <span className="drop-prompt">Drop your reviews.csv file here</span>
            ) : (
              <span>Click to select or drag & drop <strong>reviews.csv</strong> here</span>
            )}
          </label>
        </div>

        <button
          type="submit"
          disabled={loading || !file}
          className="btn btn-primary btn-upload"
        >
          {loading ? (
            <>
              <span className="btn-spinner" />
              <span>Analysing...</span>
            </>
          ) : (
            'Upload & Analyse'
          )}
        </button>
      </form>

      {loading && (
        <div className="loading-banner">
          <div className="loading-spinner"></div>
          <div className="loading-text">
            <strong>Analysing reviews with Gemini...</strong>
            <p>
              Processing uncached reviews in sequential batches with structured JSON verification.
              Cached reviews skip the AI instantly.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="alert-error" role="alert">
          <span className="alert-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
