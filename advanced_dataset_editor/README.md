# Advanced Dataset Editor

A professional dataset editor for YOLO format datasets with advanced features for annotation management.

## Features

### 🖼️ Image Management
- Thumbnail preview of images in sidebar
- Batch navigation (50 images per batch)
- Previous/Next image navigation

### 🎨 Annotation Tools
- Rectangle drawing tool with interactive mouse down/up events
- Class selection for annotations
- Annotation editing (class change, resize, delete)
- Visual indication of annotation classes with different colors
- Hover tooltips showing class names

### 🔍 Canvas Interaction
- Zoom in/out with mouse wheel
- Pan by dragging the canvas
- Crosshair lines for precise annotation placement
- Crosshair cursor style when drawing

### 📁 Dataset Support
- YOLO format dataset loading from ZIP files
- Automatic parsing of dataset.yaml for class names
- Image and annotation synchronization

## Usage

1. Drag and drop a YOLO format dataset ZIP file onto the drop zone
2. Select images from the thumbnail grid in the sidebar
3. Use the rectangle tool to draw annotations
4. Edit existing annotations by clicking on them
5. Zoom and pan the canvas for detailed work
6. Navigate between images and batches

## Technical Details

- Built with React and Konva.js for canvas manipulation
- Uses JSZip for handling ZIP file extraction
- Implements YOLO format annotation parsing
- Responsive design with batch navigation

## Technologies Used

- **React** - Frontend framework
- **Konva.js** - 2D canvas library for annotations
- **Fabric.js** - Alternative canvas library (fallback option)
- **JSZip** - ZIP file handling
- **js-yaml** - YAML parsing for dataset configuration
- **Webpack** - Module bundler
- **Babel** - JavaScript compiler

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn

## Installation

1. Navigate to the project directory:
   ```bash
   cd advanced_dataset_editor
   ```

2. Install dependencies:
   ```bash
   npm install
   ```
   or
   ```bash
   yarn install
   ```

## Usage

### Development Mode

To run the application in development mode:

```bash
npm start
```
or
```bash
yarn start
```

The application will be available at http://localhost:3001

### Production Build

To create a production build:

```bash
npm run build
```
or
```bash
yarn build
```

The build files will be in the `dist` directory.

## How to Use

1. **Upload Dataset**: Drag and drop a ZIP file containing your dataset in YOLO format
2. **Browse Images**: Use the sidebar to navigate through images in your dataset
3. **View Annotations**: See bounding boxes overlaid on images
4. **Create Annotations**: 
   - Select the "Rectangle" tool
   - Click and drag on the image to draw a rectangle annotation
5. **Edit Annotations**:
   - Click on an annotation to select it
   - Use the sidebar to view details
   - Click "Delete" to remove annotations
6. **Navigate Images**: Use the Previous/Next buttons or click on image names in the sidebar
7. **Save Work**: Click "Save Annotations" to preserve your changes
8. **Download Dataset**: Click "Download Dataset" to get your modified dataset

## Interactive Drawing Feature

The editor now supports interactive rectangle drawing similar to Roboflow:

1. Select the "Rectangle" tool from the dropdown
2. Click and hold the left mouse button on the image
3. Drag to define the size and position of the rectangle
4. Release the mouse button to create the annotation
5. The new annotation will appear with the selected class

Features of the drawing tool:
- Visual feedback during drawing with dashed outline
- Minimum size threshold to prevent accidental tiny annotations
- Proper coordinate conversion to YOLO format
- Integration with existing annotation management

## Dataset Structure

The editor works with datasets in the standard YOLO format:

```
dataset_folder/
├── dataset.yaml
├── train/
│   ├── images/
│   │   ├── image1.jpg
│   │   ├── image2.jpg
│   │   └── ...
│   └── labels/
│       ├── image1.txt
│       ├── image2.txt
│       └── ...
└── valid/
    ├── images/
    │   ├── image3.jpg
    │   ├── image4.jpg
    │   └── ...
    └── labels/
        ├── image3.txt
        ├── image4.txt
        └── ...
```

### dataset.yaml
Contains dataset configuration:
```yaml
names:
- class1
- class2
nc: 2  # number of classes
path: /path/to/dataset
train: train/images
val: valid/images
```

### Label Files
Each label file contains annotations in YOLO format:
```
class_id center_x center_y width height
0 0.5 0.5 0.3 0.4
1 0.2 0.8 0.1 0.1
```

## Technical Implementation

### Core Components

#### App.js
Main application component that handles:
- Dataset loading and parsing
- Image navigation
- Annotation management
- Canvas interaction
- UI state management

#### Canvas Interaction
- Uses Konva.js for high-performance 2D canvas rendering
- Supports zoom and pan operations
- Interactive annotation creation and editing
- Visual feedback for selected annotations
- Mouse event handling for drawing rectangles

#### Dataset Handling
- JSZip for extracting dataset files
- js-yaml for parsing dataset configuration
- Custom parsers for YOLO annotation format
- In-memory storage of annotations during editing

### Data Flow
1. User uploads dataset ZIP file
2. Application extracts and parses dataset structure
3. Images and annotations are loaded into memory
4. User interacts with canvas to view/edit annotations
5. Changes are stored in component state
6. User can save annotations or download modified dataset

## Future Enhancements

### Planned Features
1. **Polygon Annotations**: Support for complex shapes
2. **Advanced Selection Tools**: Lasso, magic wand, etc.
3. **Keyboard Shortcuts**: For faster annotation workflow
4. **Batch Operations**: Apply changes to multiple images
5. **Annotation Statistics**: View class distributions and quality metrics
6. **Collaboration Features**: Multi-user editing support
7. **Cloud Integration**: Direct upload to Roboflow and other platforms

### Technical Improvements
1. **Performance Optimization**: Virtual scrolling for large datasets
2. **Offline Support**: Progressive Web App capabilities
3. **Plugin Architecture**: Support for custom annotation types
4. **Internationalization**: Multi-language support
5. **Accessibility**: WCAG compliance for all users

## Troubleshooting

### Common Issues

#### Dataset Not Loading
- Ensure your ZIP file contains a `dataset.yaml` file
- Verify the folder structure matches the expected format
- Check that image and label files have corresponding names

#### Annotations Not Displaying
- Verify label files contain valid YOLO format data
- Check that class IDs in annotations match the classes in `dataset.yaml`

#### Performance Issues
- For large datasets, consider working with subsets
- Close browser tabs to free up memory
- Use a modern browser for best performance

### Browser Support
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Inspired by Roboflow's dataset management interface
- Built with modern web technologies for professional use
- Designed for computer vision practitioners and researchers