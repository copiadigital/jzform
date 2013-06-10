<?php

namespace JzForm\Render\Json;

use Zend\Form\FormInterface;
use Zend\Form\FieldsetInterface;
use Zend\Form\ElementInterface;
use Zend\InputFilter\InputFilter as ZfInputFilter;

class Form extends RenderAbstract {

    public function render(FormInterface $form, ZfInputFilter $inputFilter = null) {
        if (method_exists($form, 'prepare')) {
            $form->prepare();
        }

        $formData = array(
            'form' => array(
                'attributes' => $this->renderAttributes($form),
                'elements' => $this->renderElements($form),
            )
        );

        if ($inputFilter) {
            $inputData = $this->renderInputFilter($form, $inputFilter);
            foreach ($inputData as $name => $spec) {
                $original = empty($formData['form']['elements'][$name]) ? array() : $formData['form']['elements'][$name];
                $formData['form']['elements'][$name] = array_merge($original, $spec);
            }
        }

        return $formData;
    }

    public function renderElements(FieldsetInterface $form) {
        $data = array();
        foreach ($form as $element) {
            if ($element instanceof FieldsetInterface) {
                $elements = $this->renderElements($element);
                $data = array_merge($data, $elements);
            } else {
                $data[$element->getName()] = $this->renderElement($element);
            }
        }

        return $data;
    }

    public function renderElement(ElementInterface $element) {
        $render = new Element;
        return $render->render($element);
    }

    public function renderInputFilter(FormInterface $form, ZfInputFilter $inputFilter = null) {
        $data = array();

        $filterRender = new InputFilter();
        $filterData = $filterRender->render($inputFilter);

        foreach ($form as $element) {
            $name = $element->getName();
            if (array_key_exists($name, $filterData)) {
                $spec = $filterData[$name];
                $data[$name] = $spec;
            }
        }

        return $data;
    }

}