IMAGE_NAME ?= portfolio-comparator
IMAGE_TAG  ?= latest
VERSION    ?= # e.g. v1.2.0 — if set, image is also tagged with this version
REGISTRY   ?= # e.g. ghcr.io/username, docker.io/username, 123456789.dkr.ecr.us-east-1.amazonaws.com

FULL_IMAGE = $(if $(REGISTRY),$(REGISTRY)/$(IMAGE_NAME),$(IMAGE_NAME)):$(IMAGE_TAG)
VERSION_IMAGE = $(if $(REGISTRY),$(REGISTRY)/$(IMAGE_NAME),$(IMAGE_NAME)):$(VERSION)

.PHONY: build push release

build:
	docker build -t $(FULL_IMAGE) .
	$(if $(VERSION),docker tag $(FULL_IMAGE) $(VERSION_IMAGE),)

push: build
	docker push $(FULL_IMAGE)
	$(if $(VERSION),docker push $(VERSION_IMAGE),)

release: push
