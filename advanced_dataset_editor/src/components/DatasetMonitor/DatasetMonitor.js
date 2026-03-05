import React, { useState, useEffect } from 'react';
import '../../styles/styles.css';

const DatasetMonitor = ({ images, classes, datasetSplit, availableSplits, onDatasetSplitChange, onImageSelect, onBackToEditor }) => {
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedSplit, setSelectedSplit] = useState(datasetSplit);
  const [filteredImages, setFilteredImages] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [imagesPerPage] = useState(20);
  const [batchSize] = useState(50); // Batch size for grouping images
  const [selectedImageBatch, setSelectedImageBatch] = useState([]); // Images in the same batch as selected image

  // Filter images based on selected class and split
  useEffect(() => {
    let filtered = images;

    // Filter by class
    if (selectedClass !== 'all') {
      const classId = classes.indexOf(selectedClass);
      if (classId !== -1) {
        filtered = filtered.filter(image =>
          image.annotations && image.annotations.some(annotation => annotation.classId === classId)
        );
      }
    }

    setFilteredImages(filtered);
    setCurrentPage(1); // Reset to first page when filters change
    setSelectedImageBatch([]); // Clear batch when filters change
  }, [images, classes, selectedClass, selectedSplit]);

  // Handle split change
  const handleSplitChange = (newSplit) => {
    setSelectedSplit(newSplit);
    onDatasetSplitChange(newSplit);
  };

  // Handle image click to show batch
  const handleImageClick = (imageIndex, image) => {
    // Find which batch this image belongs to
    const batchIndex = Math.floor(imageIndex / batchSize);
    const batchStart = batchIndex * batchSize;
    const batchEnd = Math.min(batchStart + batchSize, filteredImages.length);
    const batchImages = filteredImages.slice(batchStart, batchEnd);

    setSelectedImageBatch(batchImages);
    onImageSelect(imageIndex);
  };

  // Pagination
  const indexOfLastImage = currentPage * imagesPerPage;
  const indexOfFirstImage = indexOfLastImage - imagesPerPage;
  const currentImages = filteredImages.slice(indexOfFirstImage, indexOfLastImage);
  const totalPages = Math.ceil(filteredImages.length / imagesPerPage);

  // Handle page change
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <div className="app">
      <div className="header">
        <h1>🔍 Dataset Monitor</h1>
        <div className="header-controls">
          <button className="button" onClick={onBackToEditor}>
            ← Back to Editor
          </button>
        </div>
      </div>

      <div className="main-content">
        <div className="sidebar">
          <h2>📁 Filter Options</h2>

          {/* Class Filter */}
          <div className="form-group">
            <label>Filter by Class:</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
            >
              <option value="all">All Classes</option>
              {classes.map((cls, index) => {
                const classId = index;
                const hasAnnotations = images.some(image =>
                  image.annotations && image.annotations.some(annotation => annotation.classId === classId)
                );
                if (!hasAnnotations) return null;
                return <option key={index} value={cls}>{cls}</option>;
              })}
            </select>
          </div>

          {/* Split Selection */}
          <div className="form-group">
            <label>Dataset Split:</label>
            <select
              value={selectedSplit}
              onChange={(e) => handleSplitChange(e.target.value)}
            >
              {/* Ensure all splits are available by default */}
              <option value="train">Train</option>
              <option value="valid">Valid</option>
              <option value="test">Test</option>
              {availableSplits.map((split) => (
                <option key={split} value={split}>
                  {split.charAt(0).toUpperCase() + split.slice(1)}
                </option>
              ))}
            </select>
            <p style={{ fontSize: '0.8rem', color: '#7f8c8d', marginTop: '5px' }}>
              Showing {filteredImages.length} images
            </p>
          </div>

          {/* Batch Information */}
          {selectedImageBatch.length > 0 && (
            <div className="stats-card">
              <h3>📦 Selected Image Batch</h3>
              <p>Batch contains {selectedImageBatch.length} images</p>
              <p>Click any image to view its batch</p>
            </div>
          )}

          {/* Statistics */}
          <div className="stats-card">
            <h3>📊 Statistics</h3>
            <p>Total Images: {images.length}</p>
            <p>Filtered Images: {filteredImages.length}</p>
            <p>Classes: {classes.length}</p>
          </div>

          {/* Class Distribution */}
          <div className="stats-card">
            <h3>🏷️ Class Distribution</h3>
            {classes.map((cls, index) => {
              const classId = index;
              const classImageCount = images.filter(image =>
                image.annotations && image.annotations.some(annotation => annotation.classId === classId)
              ).length;

              if (classImageCount === 0) return null;

              const percentage = images.length > 0 ? ((classImageCount / images.length) * 100).toFixed(1) : 0;

              return (
                <div key={index} style={{ marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span>{cls}</span>
                    <span>{classImageCount} ({percentage}%)</span>
                  </div>
                  <div style={{ height: '6px', backgroundColor: '#ecf0f1', borderRadius: '3px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        backgroundColor: `hsl(${index * 30}, 70%, 50%)`,
                        width: `${percentage}%`
                      }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="canvas-container">
          <div className="monitor-content">
            <h2>🖼️ Dataset Images</h2>

            {selectedImageBatch.length > 0 ? (
              <>
                <h3>📦 Batch Images ({selectedImageBatch.length} images)</h3>
                <div className="image-grid">
                  {selectedImageBatch.map((image, index) => {
                    // Find the global index in filteredImages
                    const globalIndex = filteredImages.findIndex(img => img.id === image.id);
                    const annotationCount = image.annotations ? image.annotations.length : 0;

                    // Get class distribution for this image
                    const classDistribution = {};
                    if (image.annotations) {
                      image.annotations.forEach(annotation => {
                        const className = classes[annotation.classId] || 'Unknown';
                        classDistribution[className] = (classDistribution[className] || 0) + 1;
                      });
                    }

                    return (
                      <div
                        key={image.id}
                        className="image-card"
                        onClick={() => handleImageClick(globalIndex, image)}
                      >
                        <div className="image-preview">
                          <img
                            src={image.src}
                            alt={image.name}
                            className="image-thumbnail"
                          />
                        </div>
                        <div className="image-info">
                          <h4 className="image-name">{image.name}</h4>
                          <div className="image-stats">
                            <span className="annotation-count">Annotations: {annotationCount}</span>
                          </div>
                          {Object.keys(classDistribution).length > 0 && (
                            <div className="class-distribution">
                              {Object.entries(classDistribution).map(([className, count]) => (
                                <span key={className} className="class-badge">
                                  {className}: {count}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button
                  className="button"
                  onClick={() => setSelectedImageBatch([])}
                  style={{ marginTop: '1rem' }}
                >
                  ← Back to All Images
                </button>
              </>
            ) : filteredImages.length > 0 ? (
              <>
                <div className="image-grid">
                  {currentImages.map((image, index) => {
                    const globalIndex = indexOfFirstImage + index;
                    const annotationCount = image.annotations ? image.annotations.length : 0;

                    // Get class distribution for this image
                    const classDistribution = {};
                    if (image.annotations) {
                      image.annotations.forEach(annotation => {
                        const className = classes[annotation.classId] || 'Unknown';
                        classDistribution[className] = (classDistribution[className] || 0) + 1;
                      });
                    }

                    return (
                      <div
                        key={image.id}
                        className="image-card"
                        onClick={() => handleImageClick(globalIndex, image)}
                      >
                        <div className="image-preview">
                          <img
                            src={image.src}
                            alt={image.name}
                            className="image-thumbnail"
                          />
                        </div>
                        <div className="image-info">
                          <h4 className="image-name">{image.name}</h4>
                          <div className="image-stats">
                            <span className="annotation-count">Annotations: {annotationCount}</span>
                          </div>
                          {Object.keys(classDistribution).length > 0 && (
                            <div className="class-distribution">
                              {Object.entries(classDistribution).map(([className, count]) => (
                                <span key={className} className="class-badge">
                                  {className}: {count}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="pagination">
                    <button
                      className="button"
                      onClick={() => paginate(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </button>

                    <span className="page-info">
                      Page {currentPage} of {totalPages}
                    </span>

                    <button
                      className="button"
                      onClick={() => paginate(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="no-data">
                <p>No images found matching the current filters.</p>
                <button
                  className="button"
                  onClick={() => setSelectedClass('all')}
                  style={{ marginTop: '1rem' }}
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="status-bar">
        <span>
          Dataset Monitor | {selectedSplit} split | {filteredImages.length} images |
          Class: {selectedClass === 'all' ? 'All Classes' : selectedClass}
        </span>
      </div>
    </div>
  );
};

export default DatasetMonitor;