import { useState, useRef } from 'react';
import { uploadCsv } from '../api';

export default function UploadBox({ onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    setError(null);
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
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
    <div className="upload-box-card">
      <div className="upload-box-header">
        <h2 className="section-title">Upload Dataset</h2>
        <span className="file-hint">CSV files up to 2 MB</span>
      </div>

      <form onSubmit={handleUpload} className="upload-form">
        <div className="file-input-wrapper">
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
            {file ? file.name : 'Choose reviews.csv or drag here'}
          </label>
        </div>

        <button
          type="submit"
          disabled={loading || !file}
          className="btn btn-primary"
        >
          {loading ? 'Analysing...' : 'Upload & Analyse'}
        </button>
      </form>

      {loading && (
        <div className="loading-banner">
          <div className="loading-spinner"></div>
          <div className="loading-text">
            <strong>Analysing reviews with Gemini...</strong>
            <p>
              Processing uncached reviews in sequential batches with structured JSON verification.
              This may take 15–30 seconds.
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
