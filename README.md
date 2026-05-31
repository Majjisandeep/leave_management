# 🥗 NutriLens — AI-Powered Nutrition Planner
### Computer Vision + Personalized Nutrition Feedback

A final-year AI/ML project featuring MobileNetV2-based food recognition, portion-based nutrition calculation, and session-aware personalized meal tracking.

---

## 📁 Project Structure

```
nutrition_planner/
│
├── app.py                        # Flask app factory + core routes
│
├── models/
│   ├── food_classifier.py        # CNN model loader + prediction pipeline
│   ├── train_model.py            # Full training script (Phase 1 + Fine-tune)
│   └── food_classifier.h5        # ← Your trained model goes here
│
├── routes/
│   └── food_vision.py            # Blueprint: /upload-food, /analyze-food, /result, etc.
│
├── utils/
│   ├── nutrition.py              # Nutrition calculator + feedback engine
│   └── image_utils.py            # Upload validation + secure filenames
│
├── templates/
│   ├── base.html                 # Design system + nav layout
│   ├── index.html                # Landing page
│   ├── upload_food.html          # Image upload + portion selector
│   ├── result.html               # Prediction results + macros + feedback
│   ├── daily_summary.html        # Meal log + daily totals
│   └── error.html                # Error handler page
│
├── data/
│   └── food_nutrition.json       # Nutrition DB: 35 foods × 5 macros per 100g
│
├── static/
│   └── uploads/                  # Saved user food images
│
├── requirements.txt
├── .env.example
└── README.md
```

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd nutrition_planner
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env — set SECRET_KEY (leave MODEL_PATH blank for demo mode)
```

### 3. Run the App

```bash
python app.py
# Open: http://localhost:5000
# Click "Try the Demo" to load a sample profile and start scanning
```

> **Demo Mode:** If no trained model file is found, the app runs with
> simulated predictions so you can test the full UI end-to-end.

---

## 🧠 Why Transfer Learning? (MobileNetV2)

### The Problem with Training from Scratch
Training a CNN from scratch on food images requires:
- 500,000+ images for decent accuracy
- Days/weeks of GPU compute
- Deep expertise in architecture design

### Transfer Learning Solution
MobileNetV2, pre-trained on **ImageNet** (1.4M images, 1000 classes), has already learned:
- Edge and texture detection (early layers)
- Shapes, patterns, and color gradients (mid layers)
- High-level semantic features (deep layers)

We **freeze** these layers and only train a new classification head on our 35 food categories.

### Why MobileNetV2 Specifically?
| Model | Parameters | Accuracy (Food-101) | Inference Speed |
|-------|-----------|---------------------|-----------------|
| Custom CNN | ~5M | ~55% | Fast |
| **MobileNetV2** | **3.4M** | **~82%** | **Very Fast** |
| ResNet50 | 25.6M | ~85% | Medium |
| EfficientNetB0 | 5.3M | ~87% | Fast |
| EfficientNetB4 | 19M | ~91% | Slow |

MobileNetV2 hits the best **accuracy/speed/size** tradeoff for a web app. Use EfficientNetB4 if you have a GPU server and need maximum accuracy.

---

## 🏋️ Training Your Own Model

### Step 1: Get a Dataset

**Option A — Food-101 (Recommended)**
```bash
# Download from Kaggle: https://www.kaggle.com/dansbecker/food-101
# Contains 101,000 images across 101 categories
# Filter to your 35 classes
```

**Option B — Custom Dataset**
```
dataset/
    train/
        pizza/          ← ~200 images minimum per class
            img001.jpg
            img002.jpg
        burger/
            ...
    val/
        pizza/          ← ~50 images per class
        burger/
            ...
```

**Option C — Web Scraping**
```python
# Use bing-image-downloader or google-images-download
pip install bing-image-downloader
python -c "from bing_image_downloader import downloader; downloader.download('pizza food', limit=300, output_dir='dataset/train')"
```

### Step 2: Run Training

```bash
python models/train_model.py \
    --dataset ./dataset \
    --model_out models/food_classifier.h5 \
    --epochs 20 \
    --batch_size 32
```

### Step 3: Two-Phase Training Strategy

```
Phase 1 (Epochs 1–20):   Base frozen → Train head only  → LR = 1e-3
                          Fast convergence, ~70–75% accuracy

Phase 2 (Epochs 21–30):  Unfreeze last 20 layers → Fine-tune → LR = 1e-5
                          Careful refinement, +5–10% accuracy boost
```

### Expected Results
- Phase 1 val accuracy: ~72–78%
- After fine-tuning: ~80–87%
- With data augmentation: +3–5% extra

---

## 🍽️ Portion Estimation Design Decision

### Why Not Predict Weight from Image?

Accurate weight estimation from a 2D image is an **unsolved research problem** that requires:
- Depth sensors (LiDAR)
- Reference objects in frame
- 3D reconstruction
- Food density knowledge

Even state-of-the-art research achieves only ±30% accuracy — too unreliable for nutrition advice.

### Our Approach: User-Assisted Portion Selection

```
Small  (~100g)  — snack, side dish, small fruit
Medium (~250g)  — standard meal serving
Large  (~400g)  — large meal, post-workout serving
```

This is **more accurate in practice** because:
1. Users know their own serving size
2. Errors are user-controlled, not algorithmic
3. Simple UX — one button press

---

## 🔌 API Usage

The app exposes a JSON API for mobile/frontend integration:

```bash
curl -X POST http://localhost:5000/api/analyze-food \
  -F "food_image=@/path/to/pizza.jpg" \
  -F "portion=medium"
```

**Response:**
```json
{
  "prediction": {
    "food_name": "pizza",
    "confidence": 91.3,
    "top5": [
      {"name": "Pizza", "confidence": 91.3},
      {"name": "Flatbread", "confidence": 4.2},
      ...
    ]
  },
  "nutrition": {
    "food": "Pizza",
    "portion": "Medium (~250g)",
    "grams": 250,
    "calories": 665.0,
    "protein": 27.5,
    "carbs": 82.5,
    "fat": 25.0,
    "fiber": 5.75,
    "found": true
  },
  "feedback": {
    "consumed_today": {"calories": 665, "protein": 27.5, ...},
    "percentages": {"calories": 30.2, "protein": 16.7, ...},
    "warnings": [],
    "suggestions": ["💪 Protein is low..."],
    "status": "good"
  }
}
```

---

## 🔧 Extending the Nutrition Database

Edit `data/food_nutrition.json` — values are **per 100g**:

```json
{
  "your_food": {
    "calories": 200,
    "protein": 10.0,
    "carbs": 25.0,
    "fat": 7.0,
    "fiber": 3.5
  }
}
```

Sources for values: USDA FoodData Central (https://fdc.nal.usda.gov/)

---

## 📈 Accuracy Improvement Roadmap

### Short Term (1–2 weeks)
- [ ] Add more food classes (Food-101 has 101 categories)
- [ ] Increase training data per class to 500+ images
- [ ] Apply heavier augmentation (cutout, mixup)

### Medium Term (1–2 months)
- [ ] Switch to EfficientNetB0/B4 for higher accuracy
- [ ] Add confidence threshold — show "Unknown food" below 40%
- [ ] Implement test-time augmentation (TTA) for better inference

### Long Term (3–6 months)
- [ ] Multi-label classification (detect multiple foods in one image)
- [ ] Fine-grained recognition (e.g., "margherita pizza" vs "pepperoni pizza")
- [ ] Barcode scanning integration (Open Food Facts API)
- [ ] Integrate GPT-4 Vision as fallback for unrecognized foods
- [ ] Mobile app with real-time camera feed

---

## 🚢 Production Deployment

```bash
# Using Gunicorn (Linux/Mac)
gunicorn -w 4 -b 0.0.0.0:8000 app:app

# Using Docker
docker build -t nutrilens .
docker run -p 8000:8000 nutrilens

# Environment variables for production
SECRET_KEY=<cryptographically-random-64-char-string>
MODEL_PATH=/app/models/food_classifier.h5
FLASK_ENV=production
```

**Production checklist:**
- [ ] Change `SECRET_KEY` to a random 64-char string
- [ ] Use a real database (PostgreSQL) instead of sessions for meal logging
- [ ] Add user authentication (Flask-Login)
- [ ] Store uploads on S3/GCS instead of local disk
- [ ] Add rate limiting (Flask-Limiter)
- [ ] Enable HTTPS

---

## 📚 References & Resources

- [MobileNetV2 Paper](https://arxiv.org/abs/1801.04381) — Sandler et al., 2018
- [Food-101 Dataset](https://data.vision.ee.ethz.ch/cvl/datasets_extra/food-101/) — Bossard et al., 2014
- [USDA FoodData Central](https://fdc.nal.usda.gov/) — Nutrition database
- [TensorFlow Transfer Learning Guide](https://www.tensorflow.org/tutorials/images/transfer_learning)
- [Keras Applications](https://keras.io/api/applications/) — All pre-trained models

---

*Built as a final-year AI/ML project. Demonstrates: transfer learning, Flask REST API, computer vision pipeline, session management, and responsive frontend design.*#   C a l o r i e s b y I m a g e  
 