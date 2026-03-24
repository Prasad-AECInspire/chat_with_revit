import React, { useState, useRef, useEffect } from 'react';

export default function ImageCropper() {
  const [image, setImage] = useState(null);
  const [cropSize, setCropSize] = useState(645);
  const [cropPosition, setCropPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [croppedImage, setCroppedImage] = useState(null);
  const [rotation, setRotation] = useState(0);
  const [rotationValue, setRotationValue] = useState(90);
  const imageRef = useRef(null);
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (image && containerRef.current) {
      setTimeout(() => {
        const containerRect = containerRef.current.getBoundingClientRect();
        setCropPosition({
          x: (containerRect.width - cropSize) / 2,
          y: (containerRect.height - cropSize) / 2
        });
      }, 100);
    }
  }, [image, cropSize]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImage(event.target.result);
        setCroppedImage(null);
        setRotation(0);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMouseDown = (e) => {
    if (e.target === imageRef.current || e.target === containerRef.current) {
      setIsDragging(true);
      updateCropPosition(e);
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    updateCropPosition(e);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const updateCropPosition = (e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const scrollLeft = containerRef.current.scrollLeft;
    const scrollTop = containerRef.current.scrollTop;
    
    const currentX = e.clientX - rect.left + scrollLeft;
    const currentY = e.clientY - rect.top + scrollTop;

    let newX = currentX - cropSize / 2;
    let newY = currentY - cropSize / 2;

    const maxX = imageRef.current.offsetWidth - cropSize;
    const maxY = imageRef.current.offsetHeight - cropSize;

    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));

    setCropPosition({ x: newX, y: newY });
  };

  const handleCrop = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = imageRef.current;

    canvas.width = cropSize;
    canvas.height = cropSize;

    const scaleX = img.naturalWidth / img.offsetWidth;
    const scaleY = img.naturalHeight / img.offsetHeight;

    const sourceX = cropPosition.x * scaleX;
    const sourceY = cropPosition.y * scaleY;
    const sourceWidth = cropSize * scaleX;
    const sourceHeight = cropSize * scaleY;

    ctx.drawImage(
      img,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      cropSize,
      cropSize
    );

    const croppedDataUrl = canvas.toDataURL('image/png');
    setCroppedImage(croppedDataUrl);
    setRotation(0);
  };

  const handleRotate = (angle) => {
    setRotation((prev) => (prev + angle) % 360);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    canvas.width = cropSize;
    canvas.height = cropSize;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Apply rotation
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
      ctx.restore();

      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `cropped-${cropSize}x${cropSize}-${Date.now()}.png`;
        link.click();
        URL.revokeObjectURL(url);
      });
    };
    img.src = croppedImage;
  };

  const handleNewImage = () => {
    setImage(null);
    setCroppedImage(null);
    setCropPosition({ x: 100, y: 100 });
    setRotation(0);
  };

  const handleBack = () => {
    setCroppedImage(null);
    setRotation(0);
  };

  return (
    <div style={styles.body}>
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.h1}>Image Cropper with Rotation</h1>
          <p style={styles.subtitle}>
            {!image ? 'Upload an image to get started' : 
             !croppedImage ? 'Adjust crop size and select area' : 
             'Rotate and save your cropped image'}
          </p>

          {!image ? (
            <label style={styles.uploadArea} htmlFor="fileInput">
              <svg style={styles.uploadIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
              </svg>
              <span style={styles.uploadText}>Click to upload image</span>
              <span style={styles.uploadSubtext}>PNG, JPG, or WebP</span>
              <input
                id="fileInput"
                type="file"
                style={styles.fileInput}
                accept="image/*"
                onChange={handleImageUpload}
              />
            </label>
          ) : !croppedImage ? (
            <div>
              <div style={styles.controlsBar}>
                <div style={styles.sizeControl}>
                  <label style={styles.label}>Crop Size:</label>
                  <input
                    type="number"
                    value={cropSize}
                    onChange={(e) => setCropSize(Math.max(0, Math.min(2000, parseInt(e.target.value))))}
                    style={styles.input}
                    min="0"
                    max="2000"
                  />
                  <span style={styles.sizeLabel}>{cropSize}Ã—{cropSize} px</span>
                </div>
              </div>

              <p style={styles.instructions}>Click and drag on the image to position your crop area</p>
              <div style={styles.imageViewer}>
                <div
                  ref={containerRef}
                  style={styles.imageContainer}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  <img
                    ref={imageRef}
                    src={image}
                    alt="Uploaded"
                    style={styles.uploadedImage}
                  />
                  <div
                    style={{
                      ...styles.cropBox,
                      left: `${cropPosition.x}px`,
                      top: `${cropPosition.y}px`,
                      width: `${cropSize}px`,
                      height: `${cropSize}px`,
                    }}
                  >
                    <div style={styles.cropLabel}>{cropSize}Ã—{cropSize}</div>
                    <div style={styles.cropCorners}>
                      <div style={{...styles.corner, ...styles.cornerTopLeft}}></div>
                      <div style={{...styles.corner, ...styles.cornerTopRight}}></div>
                      <div style={{...styles.corner, ...styles.cornerBottomLeft}}></div>
                      <div style={{...styles.corner, ...styles.cornerBottomRight}}></div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={styles.buttonGroup}>
                <button onClick={handleCrop} style={{...styles.btn, ...styles.btnPrimary}}>
                  <svg style={styles.btnIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z"></path>
                  </svg>
                  Crop Image
                </button>
                <button onClick={handleNewImage} style={{...styles.btn, ...styles.btnSecondary}}>
                  Upload New Image
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div style={styles.previewContainer}>
                <div style={styles.previewBox}>
                  <img
                    src={croppedImage}
                    alt="Cropped"
                    style={{
                      ...styles.previewImage,
                      transform: `rotate(${rotation}deg)`,
                    }}
                  />
                </div>
              </div>

              <div style={styles.rotationControls}>
                  <span style={styles.rotationLabel}>Rotate:</span>
  
  <div style={styles.sizeControl}>
    <label style={styles.label}>Custom Angle:</label>
    <input
      type="number"
      value={rotationValue}
      onChange={(e) => setRotationValue(parseInt(e.target.value))}
      style={{...styles.input, width: '80px'}}
      min="-360"
      max="360"
    />
    <span>Â°</span>
  </div>
  
  <button onClick={() => handleRotate(rotationValue)} style={{...styles.btn, ...styles.btnRotate}}>
    <svg style={styles.btnIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
    </svg>
    Apply
  </button>
  
  <button onClick={() => handleRotate(-90)} style={{...styles.btn, ...styles.btnRotate}}>
    90Â° Left
  </button>
  <button onClick={() => handleRotate(90)} style={{...styles.btn, ...styles.btnRotate}}>
    90Â° Right
  </button>
  
  <span style={styles.rotationValue}>Current: {rotation}Â°</span>
              </div>

              <div style={styles.buttonGroup}>
                <button onClick={handleSave} style={{...styles.btn, ...styles.btnPrimary}}>
                  <svg style={styles.btnIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                  </svg>
                  Save Image
                </button>
                <button onClick={handleBack} style={{...styles.btn, ...styles.btnSecondary}}>
                  Back to Crop
                </button>
                <button onClick={handleNewImage} style={{...styles.btn, ...styles.btnSecondary}}>
                  New Image
                </button>
              </div>
            </div>
          )}

          <canvas ref={canvasRef} style={styles.canvas}></canvas>
        </div>
      </div>
    </div>
  );
}

const styles = {
  body: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #1763c0ff 0%, #e0e7ff 100%)',
    padding: '2rem',
  },
  container: {
    maxWidth: '1800px',
    margin: '0 auto',
  },
  card: {
    background: 'white',
    borderRadius: '1rem',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    padding: '2rem',
  },
  h1: {
    fontSize: '2rem',
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: '0.5rem',
  },
  subtitle: {
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: '1.5rem',
  },
  uploadArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '16rem',
    border: '2px dashed #a5b4fc',
    borderRadius: '0.75rem',
    cursor: 'pointer',
    transition: 'all 0.3s',
  },
  uploadIcon: {
    width: '3rem',
    height: '3rem',
    color: '#a5b4fc',
    marginBottom: '1rem',
  },
  uploadText: {
    fontSize: '1.125rem',
    fontWeight: '500',
    color: '#374151',
  },
  uploadSubtext: {
    fontSize: '0.875rem',
    color: '#9ca3af',
    marginTop: '0.25rem',
  },
  fileInput: {
    display: 'none',
  },
  controlsBar: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: '1.5rem',
    padding: '1rem',
    background: '#f9fafb',
    borderRadius: '0.5rem',
    border: '1px solid #e5e7eb',
  },
  sizeControl: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  label: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#374151',
  },
  input: {
    width: '120px',
    padding: '0.5rem',
    border: '2px solid #d1d5db',
    borderRadius: '0.5rem',
    fontSize: '1rem',
    textAlign: 'center',
  },
  sizeLabel: {
    fontSize: '0.95rem',
    color: '#6366f1',
    fontWeight: '600',
  },
  instructions: {
    textAlign: 'center',
    color: '#6b7280',
    marginBottom: '1rem',
    fontSize: '0.95rem',
  },
  imageViewer: {
    position: 'relative',
    width: '100%',
    height: '80vh',
    minHeight: '400px',
    overflow: 'hidden',
    border: '2px solid #e5e7eb',
    borderRadius: '0.75rem',
    background: '#7a838bff',
    cursor: 'crosshair',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'auto',
  },
  uploadedImage: {
    display: 'block',
    maxWidth: 'none',
    height: 'auto',
    minWidth: '100%',
    userSelect: 'none',
  },
  cropBox: {
    position: 'absolute',
    border: '3px solid #6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
    pointerEvents: 'none',
    zIndex: 10,
  },
  cropLabel: {
    position: 'absolute',
    top: '-35px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: '#6366f1',
    color: 'white',
    padding: '0.5rem 1rem',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    fontWeight: '600',
    whiteSpace: 'nowrap',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  },
  cropCorners: {
    position: 'absolute',
    inset: '-6px',
    pointerEvents: 'none',
  },
  corner: {
    position: 'absolute',
    width: '20px',
    height: '20px',
    border: '3px solid white',
    background: '#6366f1',
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderRight: 'none',
    borderBottom: 'none',
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderLeft: 'none',
    borderBottom: 'none',
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderRight: 'none',
    borderTop: 'none',
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderLeft: 'none',
    borderTop: 'none',
  },
  previewContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: '2rem',
    minHeight: '400px',
  },
  previewBox: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '2rem',
    background: '#f9fafb',
    borderRadius: '0.75rem',
    border: '2px solid #e5e7eb',
  },
  previewImage: {
    maxWidth: '600px',
    maxHeight: '600px',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    borderRadius: '0.5rem',
    transition: 'transform 0.3s ease',
  },
  rotationControls: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '1rem',
    marginBottom: '1.5rem',
    padding: '1rem',
    background: '#f9fafb',
    borderRadius: '0.5rem',
    flexWrap: 'wrap',
  },
  rotationLabel: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#374151',
  },
  rotationValue: {
    fontSize: '0.95rem',
    color: '#6366f1',
    fontWeight: '600',
    padding: '0.5rem 1rem',
    background: 'white',
    borderRadius: '0.5rem',
    border: '2px solid #6366f1',
  },
  buttonGroup: {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'center',
    marginTop: '1.5rem',
    flexWrap: 'wrap',
  },
  btn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.5rem',
    borderRadius: '0.5rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.3s',
    fontSize: '1rem',
    border: 'none',
  },
  btnPrimary: {
    backgroundColor: '#6366f1',
    color: 'white',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  },
  btnSecondary: {
    backgroundColor: 'white',
    color: '#374151',
    border: '2px solid #d1d5db',
  },
  btnRotate: {
    backgroundColor: '#f3f4f6',
    color: '#374151',
    border: '2px solid #d1d5db',
  },
  btnIcon: {
    width: '1.25rem',
    height: '1.25rem',
  },
  canvas: {
    display: 'none',
  },
};