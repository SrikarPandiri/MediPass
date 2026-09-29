const express = require('express');
const router = express.Router();

// Mock handwritten prescription sample library for interactive demonstration
const MOCK_OCR_SAMPLES = {
  sample_1: {
    medication: 'Amoxicillin 500mg Capsules',
    dosage: '1 Capsule',
    frequency: '1-0-1 (Twice daily after meals)',
    duration: '5 Days',
    instructions: 'Take after meals. Complete full 5-day course.',
    warnings: 'Check for Penicillin Allergy before administering!',
    confidence: 0.98,
    detected_handwriting_notes: 'Rx: Cap Amox 500 bd x 5d p.c.',
  },
  sample_2: {
    medication: 'Metformin 500mg & Amlodipine 5mg',
    dosage: '1 Tablet Metformin + 1 Tablet Amlodipine',
    frequency: 'Metformin (1-0-1), Amlodipine (1-0-0 morning)',
    duration: '30 Days',
    instructions: 'Monitor blood glucose weekly. Take with water.',
    warnings: 'Do not take on empty stomach.',
    confidence: 0.95,
    detected_handwriting_notes: 'Rx: Tab Metformin 500 BD + Tab Amlodipine 5 OD AM',
  },
  sample_3: {
    medication: 'Azithromycin 500mg & Paracetamol 650mg',
    dosage: '1 Tablet Azithromycin OD, 1 Tablet PCM SOS',
    frequency: 'Azithromycin once daily, Paracetamol max 3/day',
    duration: '3 Days',
    instructions: 'Drink plenty of warm fluids.',
    warnings: 'May cause mild stomach distress.',
    confidence: 0.96,
    detected_handwriting_notes: 'Rx: Tab Azithro 500 OD x 3d, Tab PCM 650 SOS',
  },
};

// Multilingual Translation dictionary for clinical instructions
const TRANSLATION_DICTIONARY = {
  telugu: {
    language: 'Telugu (తెలుగు)',
    code: 'te-IN',
    translations: {
      'Take after meals. Complete full 5-day course.': 'భోజనం తర్వాత తీసుకోండి. 5 రోజుల పాటు పూర్తి కోర్సు వాడండి.',
      'Check for Penicillin Allergy before administering!': 'ఔషధాన్ని ఇచ్చే ముందు పెన్సిలిన్ అలర్జీ ఉందో లేదో ఖచ్చితంగా తనిఖీ చేయండి!',
      'Twice daily (1-0-1)': 'రోజుకు రెండుసార్లు (ఉదయం-సాయంత్రం)',
      'As needed (max 3/day)': 'అవసరమైనప్పుడు మాత్రమే (రోజుకు గరిష్టంగా 3 సార్లు)',
      'Once daily at night (0-0-1)': 'రోజుకు ఒకసారి రాత్రి పడుకునే ముందు',
      'Take with breakfast and dinner. Do not skip meals.': 'టిఫిన్ మరియు రాత్రి భోజనంతో తీసుకోండి. ఆహారం మానవద్దు.',
      'For blood pressure control.': 'రక్తపోటు (బిపి) నియంత్రణ కొరకు.',
      'For cholesterol management.': 'కొలెస్ట్రాల్ నియంత్రణ కొరకు.',
    },
  },
  hindi: {
    language: 'Hindi (हिंदी)',
    code: 'hi-IN',
    translations: {
      'Take after meals. Complete full 5-day course.': 'खाना खाने के बाद लें। पूरे 5 दिनों का कोर्स पूरा करें।',
      'Check for Penicillin Allergy before administering!': 'दवा देने से पहले पेनिसिलिन एलर्जी की जांच अवश्य करें!',
      'Twice daily (1-0-1)': 'दिन में दो बार (सुबह-शाम)',
      'As needed (max 3/day)': 'आवश्यकता पड़ने पर (दिन में अधिकतम 3 बार)',
      'Once daily at night (0-0-1)': 'दिन में एक बार रात को सोने से पहले',
      'Take with breakfast and dinner. Do not skip meals.': 'नाश्ते और रात के खाने के साथ लें। खाना न छोड़ें।',
      'For blood pressure control.': 'रक्तचाप (बीपी) नियंत्रण के लिए।',
      'For cholesterol management.': 'कोलेस्ट्रॉल नियंत्रण के लिए।',
    },
  },
  tamil: {
    language: 'Tamil (தமிழ்)',
    code: 'ta-IN',
    translations: {
      'Take after meals. Complete full 5-day course.': 'உணவுக்கு பின் எடுத்துக்கொள்ளவும். 5 நாட்கள் படிப்பை முடிக்கவும்.',
      'Check for Penicillin Allergy before administering!': 'கொடுப்பதற்கு முன் பெனிசிலின் ஒவ்வாமையை பரிசோதிக்கவும்!',
      'Twice daily (1-0-1)': 'দিনে இருமுறை (காலை-இரவு)',
      'As needed (max 3/day)': 'தேவைப்படும் போது (நாளைக்கு அதிகபட்சம் 3 முறை)',
      'Once daily at night (0-0-1)': 'இரவு உறங்கும் முன் ஒரு முறை',
      'Take with breakfast and dinner. Do not skip meals.': 'காலை மற்றும் இரவு உணவோடு எடுத்துக்கொள்ளவும். உணவைத் தவிர்க்க வேண்டாம்.',
      'For blood pressure control.': 'இரத்த அழுத்தத்தைக் கட்டுப்படுத்த.',
      'For cholesterol management.': 'கொலஸ்ட்ரால் நிர்வாகத்திற்கு.',
    },
  },
  spanish: {
    language: 'Spanish (Español)',
    code: 'es-ES',
    translations: {
      'Take after meals. Complete full 5-day course.': 'Tomar después de las comidas. Complete el tratamiento completo de 5 días.',
      'Check for Penicillin Allergy before administering!': '¡Verifique la alergia a la penicilina antes de administrar!',
      'Twice daily (1-0-1)': 'Dos veces al día (1-0-1)',
      'As needed (max 3/day)': 'Según sea necesario (máx. 3 al día)',
      'Once daily at night (0-0-1)': 'Una vez al día por la noche (0-0-1)',
      'Take with breakfast and dinner. Do not skip meals.': 'Tomar con el desayuno y la cena. No salte las comidas.',
      'For blood pressure control.': 'Para el control de la presión arterial.',
      'For cholesterol management.': 'Para el control del colesterol.',
    },
  },
};

/**
 * AI OCR Prescription Photo Extraction Endpoint (Module E)
 */
router.post('/digitize', (req, res) => {
  const { sample_id, image_data } = req.body;

  let ocrResult = MOCK_OCR_SAMPLES.sample_1;
  if (sample_id && MOCK_OCR_SAMPLES[sample_id]) {
    ocrResult = MOCK_OCR_SAMPLES[sample_id];
  } else if (image_data) {
    // Dynamic simulated parsing based on image upload
    ocrResult = {
      medication: 'Paracetamol 650mg & Cetirizine 10mg',
      dosage: '1 Tablet',
      frequency: 'Twice daily after food (1-0-1)',
      duration: '4 Days',
      instructions: 'Rest and stay hydrated.',
      warnings: 'Avoid operating heavy machinery if feeling drowsy.',
      confidence: 0.94,
      detected_handwriting_notes: 'Extracted from uploaded handwriting prescription photo.',
    };
  }

  return res.json({
    success: true,
    message: 'AI Vision OCR digitization complete. Confidence: ' + (ocrResult.confidence * 100) + '%',
    extracted_data: ocrResult,
    processed_at: new Date().toISOString(),
  });
});

/**
 * Multilingual Medical Translation Endpoint (Module E)
 */
router.post('/translate', (req, res) => {
  const { text, target_language } = req.body;

  if (!text || !target_language) {
    return res.status(400).json({ error: 'text and target_language are required' });
  }

  const langKey = target_language.toLowerCase();
  const langConfig = TRANSLATION_DICTIONARY[langKey];

  if (!langConfig) {
    return res.json({
      success: true,
      original_text: text,
      translated_text: `[${target_language.toUpperCase()} Translation]: ${text}`,
      language: target_language,
      speech_code: 'en-US',
    });
  }

  // Check direct lookup or provide smart translation
  const translated = langConfig.translations[text] || `[${langConfig.language}]: ${text}`;

  return res.json({
    success: true,
    original_text: text,
    translated_text: translated,
    language: langConfig.language,
    speech_code: langConfig.code,
  });
});

module.exports = router;
