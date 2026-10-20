from PIL import Image, ImageFilter
src=Image.open(r'D:\typed-document-v2\inputs\Handwritten_to_TypedDoc_Transformation.png').convert('RGBA')
W,H=1280,720
# Warm paper background and blurred enlarged logo preserve the full original without cropping.
bg=Image.new('RGBA',(W,H),(245,240,232,255))
cover=src.copy(); cover.thumbnail((W,H))
# create a subtle blurred background layer from the logo for edge continuity
scale=max(W/src.width,H/src.height)
large=src.resize((int(src.width*scale),int(src.height*scale)),Image.Resampling.LANCZOS)
left=(large.width-W)//2; top=(large.height-H)//2
blur=large.crop((left,top,left+W,top+H)).filter(ImageFilter.GaussianBlur(28))
blur.putalpha(55)
bg.alpha_composite(blur)
# fit full logo centered on warm canvas
fit=src.copy(); fit.thumbnail((W-80,H-40),Image.Resampling.LANCZOS)
bg.alpha_composite(fit,((W-fit.width)//2,(H-fit.height)//2))
bg.convert('RGB').save(r'D:\typed-document-v2\.work\typedoc_logo_landscape_reference.jpg',quality=95)
print('created',W,H)
