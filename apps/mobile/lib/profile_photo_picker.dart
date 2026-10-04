import 'package:flutter/material.dart';
import 'package:image_cropper/image_cropper.dart';
import 'package:image_picker/image_picker.dart';

Future<XFile?> pickCroppedProfilePhoto() async {
  final picked = await ImagePicker().pickImage(
    source: ImageSource.gallery,
    imageQuality: 90,
  );
  if (picked == null) return null;
  final cropped = await ImageCropper().cropImage(
    sourcePath: picked.path,
    maxWidth: 2000,
    maxHeight: 2000,
    compressFormat: ImageCompressFormat.jpg,
    compressQuality: 88,
    uiSettings: [
      AndroidUiSettings(
        toolbarTitle: 'Fotoğrafı kırp',
        toolbarColor: const Color(0xFF641D3A),
        toolbarWidgetColor: Colors.white,
        activeControlsWidgetColor: const Color(0xFF641D3A),
        initAspectRatio: CropAspectRatioPreset.ratio4x3,
        lockAspectRatio: false,
      ),
      IOSUiSettings(
        title: 'Fotoğrafı kırp',
        doneButtonTitle: 'Kullan',
        cancelButtonTitle: 'Vazgeç',
      ),
    ],
  );
  return cropped == null
      ? null
      : XFile(cropped.path, name: 'profile-photo.jpg');
}
